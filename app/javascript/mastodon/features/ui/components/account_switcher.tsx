/* eslint-disable react/jsx-no-bind */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FC,
  MouseEvent as ReactMouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, useIntl } from 'react-intl';
import type { MessageDescriptor } from 'react-intl';

import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import DeleteIcon from '@/material-icons/400-24px/delete.svg?react';
import { showAlert } from 'mastodon/actions/alerts';
import {
  registerAccount,
  switchAccount,
  registerAccountAction,
  removeAccount,
} from 'mastodon/actions/multi_account';
import api, { currentAuthorizationToken } from 'mastodon/api';
import { CircularProgress } from 'mastodon/components/circular_progress';
import { Icon } from 'mastodon/components/icon';
import { useAppDispatch, useAppSelector } from 'mastodon/store';
import type { MultiAccountEntry } from 'mastodon/types/multi_account';
import { logOut } from 'mastodon/utils/log_out';
import {
  clearAllAccounts,
  loadAllEntries,
  loadEncryptedToken,
} from 'mastodon/utils/multi_account_db';
import { clearActiveAccountIdInStorage } from 'mastodon/utils/multi_account_storage';

const loadMultiAccountsModule = () => import('mastodon/api/multi_accounts');

const loadCallbackHandlerModule = () =>
  import('mastodon/features/multi_account/callback_handler');

// Helper to dispatch thunks that return async functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dispatchThunk = (dispatch: any, thunk: any): Promise<any> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  dispatch(thunk);

interface ImmutableLike {
  get?: (key: string) => unknown;
  has?: (key: string) => boolean;
  toList?: () => ImmutableListLike;
  toJS?: () => unknown;
}

interface ImmutableListLike {
  forEach: (cb: (entry: unknown) => void) => void;
  map: (cb: (entry: unknown) => unknown) => ImmutableListLike;
  filter: (cb: (entry: unknown) => boolean) => ImmutableListLike;
  size?: number;
  length?: number;
}

const messages = defineMessages({
  switchAccount: {
    id: 'account_switcher.switch_account',
    defaultMessage: 'Switch account',
  },
  addError: {
    id: 'account_switcher.add_error',
    defaultMessage: 'Failed to add account.',
  },
  switchError: {
    id: 'account_switcher.switch_error',
    defaultMessage: 'Failed to switch account.',
  },
  popupBlocked: {
    id: 'account_switcher.popup_blocked',
    defaultMessage: 'Popup was blocked. Please allow popups for this site.',
  },
  oauthPopupClosed: {
    id: 'account_switcher.oauth_popup_closed',
    defaultMessage: 'OAuth popup was closed before authorization completed.',
  },
  manageTitle: {
    id: 'account_switcher.manage_title',
    defaultMessage: 'Account management',
  },
  manageAddExisting: {
    id: 'account_switcher.manage_add_existing',
    defaultMessage: 'Add an existing account',
  },
  manageEmpty: {
    id: 'account_switcher.manage_empty',
    defaultMessage: 'No additional accounts added.',
  },
  manageSwitch: {
    id: 'account_switcher.manage_switch',
    defaultMessage: 'Switch',
  },
  manageDelete: {
    id: 'account_switcher.manage_delete',
    defaultMessage: 'Log out & remove',
  },
  manageDeleteConfirmTitle: {
    id: 'account_switcher.manage_delete_confirm_title',
    defaultMessage: 'Remove {displayName}?',
  },
  manageDeleteConfirmDescription: {
    id: 'account_switcher.manage_delete_confirm_description',
    defaultMessage:
      'Removing this account will delete saved login data and sign it out on this device.',
  },
  manageDeleteCancel: {
    id: 'account_switcher.manage_delete_cancel',
    defaultMessage: 'Cancel',
  },
  manageDeleteConfirm: {
    id: 'account_switcher.manage_delete_confirm',
    defaultMessage: 'Remove account',
  },
  manageRemoveSuccess: {
    id: 'account_switcher.manage_remove_success',
    defaultMessage: 'Account removed from this device.',
  },
  manageRemoveFailure: {
    id: 'account_switcher.manage_remove_failure',
    defaultMessage: 'Failed to remove account. Please try again.',
  },
  manageSignOutFailure: {
    id: 'account_switcher.manage_sign_out_failure',
    defaultMessage: 'Account removed locally, but server sign-out failed.',
  },
  manageLogoutAll: {
    id: 'account_switcher.manage_logout_all',
    defaultMessage: 'Log out of all accounts',
  },
  manageLogoutAllError: {
    id: 'account_switcher.manage_logout_all_error',
    defaultMessage: 'Failed to log out of all accounts.',
  },
  switchTokenInvalid: {
    id: 'account_switcher.switch_token_invalid',
    defaultMessage:
      'Login info for this account is invalid or expired. Would you like to remove it?',
  },
});

interface AccountSwitcherTriggerArgs {
  openManage: () => void;
}

interface AccountSwitcherProps {
  renderTrigger?: (options: AccountSwitcherTriggerArgs) => ReactNode;
}

const knownErrorMessages: Record<string, MessageDescriptor> = {
  'OAuth popup was closed before authorization completed':
    messages.oauthPopupClosed,
};

export const AccountSwitcher: FC<AccountSwitcherProps> = ({
  renderTrigger,
}) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const storingAccountIdsRef = useRef<Set<string>>(new Set());
  const [persistedAccounts, setPersistedAccounts] = useState<
    MultiAccountEntry[]
  >([]);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [pendingDeletion, setPendingDeletion] =
    useState<MultiAccountEntry | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null,
  );

  const multiAccountState = useAppSelector(
    (state) => state.multiAccount as unknown as ImmutableLike | null,
  );

  const currentAccount = useAppSelector((state) => {
    const meId = state.meta.get('me') as string | undefined;
    if (!meId) return undefined;
    return state.accounts.get(meId);
  });

  const activeAccountId = useMemo(() => {
    if (!multiAccountState?.get) return null;
    return (multiAccountState.get('activeAccountId') as string | null) ?? null;
  }, [multiAccountState]);

  const accounts = useMemo(() => {
    if (!multiAccountState?.get) return null;
    return multiAccountState.get('accounts') as ImmutableLike | null;
  }, [multiAccountState]);

  // Initialize callback handler on mount
  useEffect(() => {
    let isMounted = true;
    let cleanupHandler: (() => void) | undefined;

    const setup = async () => {
      const { initializeCallbackHandler, cleanupCallbackHandler } =
        await loadCallbackHandlerModule();
      if (!isMounted) {
        cleanupCallbackHandler();
        return;
      }
      initializeCallbackHandler();
      cleanupHandler = cleanupCallbackHandler;
    };

    void setup();

    return () => {
      isMounted = false;
      if (cleanupHandler) {
        cleanupHandler();
      } else {
        void loadCallbackHandlerModule().then(({ cleanupCallbackHandler }) => {
          cleanupCallbackHandler();
        });
      }
    };
  }, []);

  // Load persisted accounts from IndexedDB
  useEffect(() => {
    void loadAllEntries()
      .then((entries) => {
        setPersistedAccounts(Object.values(entries));
      })
      .catch((error: unknown) => {
        console.error('Failed to load persisted multi-account entries:', error);
      });
  }, []);

  const mergedAccounts = useMemo(() => {
    const map = new Map<string, MultiAccountEntry>();

    persistedAccounts.forEach((entry) => {
      if (entry.id) {
        map.set(entry.id, entry);
      }
    });

    if (accounts?.toList) {
      const list = accounts.toList();
      list.forEach((rawEntry: unknown) => {
        const immEntry = rawEntry as ImmutableLike | null;
        const normalized = (immEntry?.toJS?.() ??
          rawEntry) as MultiAccountEntry | null;
        if (normalized?.id) {
          map.set(normalized.id, normalized);
        }
      });
    }

    return Array.from(map.values());
  }, [accounts, persistedAccounts]);

  const managedAccounts = useMemo(() => {
    return [...mergedAccounts]
      .sort((a, b) => {
        const aIsActive = a.id === activeAccountId;
        const bIsActive = b.id === activeAccountId;
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;

        const nameA = (a.displayName || a.acct || a.id || '').toLowerCase();
        const nameB = (b.displayName || b.acct || b.id || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      })
      .slice(0, 10);
  }, [mergedAccounts, activeAccountId]);

  const ensureAccountRegistered = useCallback(
    async (accountId: string) => {
      const accountExists = !!accounts?.has?.(accountId);
      if (accountExists) return true;

      const fallbackEntry = mergedAccounts.find(
        (entry) => entry.id === accountId,
      );
      if (fallbackEntry) {
        dispatch(registerAccountAction(fallbackEntry));
        return true;
      }

      try {
        const storedEntries = await loadAllEntries();
        const storedEntry = storedEntries[accountId];
        if (storedEntry) {
          dispatch(registerAccountAction(storedEntry));
          return true;
        }
      } catch (loadError: unknown) {
        console.error(
          `Failed to load entry for account ${accountId}:`,
          loadError,
        );
      }

      return false;
    },
    [accounts, mergedAccounts, dispatch],
  );

  const handleSwitchAccount = useCallback(
    async (accountId: string) => {
      try {
        const registered = await ensureAccountRegistered(accountId);
        if (!registered) {
          throw new Error('Could not load the account.');
        }
        await dispatchThunk(dispatch, switchAccount(accountId));
      } catch (error: unknown) {
        console.error(error);

        // If the error indicates an invalid/expired token (401-like),
        // ask the user if they want to remove the account
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isTokenInvalid =
          errorMessage.includes('Invalid token') ||
          errorMessage.includes('expired') ||
          errorMessage.includes('revoked') ||
          errorMessage.includes('re-add');

        if (isTokenInvalid) {
          const entry = mergedAccounts.find((e) => e.id === accountId);
          if (entry) {
            // Show deletion confirmation for the failed account
            setPendingDeletion(entry);
            dispatch(
              showAlert({
                message: intl.formatMessage(messages.switchTokenInvalid),
              }),
            );
            return;
          }
        }

        dispatch(
          showAlert({
            message:
              error instanceof Error
                ? error.message
                : intl.formatMessage(messages.switchError),
          }),
        );
      }
    },
    [dispatch, ensureAccountRegistered, intl, mergedAccounts],
  );

  const ensureAccountStored = useCallback(async () => {
    if (!currentAccount) return;

    const accountId = currentAccount.get('id');
    if (!accountId) return;

    const hasStoredAccount = !!accounts?.has?.(accountId);
    if (hasStoredAccount || storingAccountIdsRef.current.has(accountId)) return;

    try {
      const existingEncrypted = await loadEncryptedToken(accountId);
      if (existingEncrypted) return;
    } catch {
      // no existing token, proceed
    }

    const token = currentAuthorizationToken();
    if (!token) return;

    storingAccountIdsRef.current.add(accountId);

    const acct =
      currentAccount.get('acct') || currentAccount.get('username') || '';
    const displayName =
      currentAccount.get('display_name') ||
      currentAccount.get('username') ||
      '';
    const avatar =
      currentAccount.get('avatar') || currentAccount.get('avatar_static') || '';

    const entry: MultiAccountEntry = {
      id: accountId,
      acct,
      displayName,
      avatar,
      encryptedTokenRef: '',
      lastUsedAt: new Date().toISOString(),
    };

    try {
      await dispatchThunk(dispatch, registerAccount(entry, token));
    } catch (error: unknown) {
      console.error(
        'Failed to register current account for multi-account storage:',
        error,
      );
    } finally {
      storingAccountIdsRef.current.delete(accountId);
    }
  }, [accounts, currentAccount, dispatch]);

  // Auto-register current account
  useEffect(() => {
    void ensureAccountStored();
  }, [ensureAccountStored]);

  const handleOpenManageFromTrigger = useCallback(() => {
    setIsManageOpen(true);
  }, []);

  const handleCloseManage = useCallback(() => {
    setIsManageOpen(false);
    setPendingDeletion(null);
  }, []);

  // ESC key closes modal
  useEffect(() => {
    if (!isManageOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseManage();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isManageOpen, handleCloseManage]);

  // Reload persisted accounts when modal opens to get latest display names
  useEffect(() => {
    if (!isManageOpen) return;

    void loadAllEntries()
      .then((entries) => {
        setPersistedAccounts(Object.values(entries));
      })
      .catch((error: unknown) => {
        console.error(
          'Failed to reload persisted multi-account entries:',
          error,
        );
      });
  }, [isManageOpen]);

  const handleRequestDelete = useCallback((entry: MultiAccountEntry) => {
    setPendingDeletion(entry);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setPendingDeletion(null);
  }, []);

  const handleConfirmDelete = useCallback(
    async (entry: MultiAccountEntry) => {
      if (!entry.id || deletingAccountId) return;

      setDeletingAccountId(entry.id);

      try {
        await dispatchThunk(dispatch, removeAccount(entry.id));
        setPersistedAccounts((prev) =>
          prev.filter((stored) => stored.id && stored.id !== entry.id),
        );

        dispatch(
          showAlert({
            message: intl.formatMessage(messages.manageRemoveSuccess),
          }),
        );

        if (entry.id === activeAccountId) {
          try {
            await api(false).delete('/auth/sign_out', {
              headers: { Accept: 'application/json' },
            });
          } catch (signOutError: unknown) {
            console.error(
              'Failed to sign out after removing active account:',
              signOutError,
            );
            dispatch(
              showAlert({
                message: intl.formatMessage(messages.manageSignOutFailure),
              }),
            );
          } finally {
            window.location.reload();
          }
        }
      } catch (error: unknown) {
        console.error('Failed to remove account:', error);
        dispatch(
          showAlert({
            message: intl.formatMessage(messages.manageRemoveFailure),
          }),
        );
      } finally {
        setDeletingAccountId(null);
        setPendingDeletion(null);
      }
    },
    [dispatch, intl, activeAccountId, deletingAccountId],
  );

  const handleAddAccount = useCallback(() => {
    const add = async () => {
      const currentAccountId = currentAccount ? currentAccount.get('id') : null;

      try {
        setIsProcessing(true);

        // Step 1: Ensure we have current account's token stored BEFORE opening popup
        // (popup login will change the session cookie)
        if (currentAccountId) {
          try {
            const response = await api().post<{
              token?: string;
              account?: {
                id?: string;
                acct?: string;
                username?: string;
                display_name?: string;
                avatar?: string;
                avatar_static?: string;
              };
            }>('/api/v1/multi_accounts/refresh_token');

            const { token, account } = response.data;
            if (token && account) {
              const refreshedEntry: MultiAccountEntry = {
                id: account.id ?? currentAccountId,
                acct: account.acct ?? account.username ?? '',
                displayName: account.display_name ?? account.username ?? '',
                avatar: account.avatar ?? account.avatar_static ?? '',
                encryptedTokenRef: '',
                lastUsedAt: new Date().toISOString(),
              };
              await dispatchThunk(
                dispatch,
                registerAccount(refreshedEntry, token),
              );
            }
          } catch (refreshError: unknown) {
            console.error(
              '[MultiAccount] Pre-OAuth: token refresh FAILED',
              refreshError,
            );
          }
        }

        // Step 2: Get authorize URL with force_login so user must log into a different account
        const [
          { fetchAuthorizeEntry, consumeAuthorizationCode },
          { openOAuthPopup },
        ] = await Promise.all([
          loadMultiAccountsModule(),
          loadCallbackHandlerModule(),
        ]);

        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const blankPopup = window.open(
          'about:blank',
          'multi-account-oauth',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no`,
        );

        if (!blankPopup) {
          throw new Error(intl.formatMessage(messages.popupBlocked));
        }

        const authorizeEntry = await fetchAuthorizeEntry({ forceLogin: true });
        const { authorize_url: authorizeUrl, state, nonce } = authorizeEntry;

        // Step 3: Open OAuth popup - user logs into B account
        // Note: This changes the session cookie to B account's session
        const callback = await openOAuthPopup(authorizeUrl, state, blankPopup);

        // Step 4: Consume authorization code to get B account's long-lived token
        // Uses api(false) so no auth header needed
        const { token, account } = await consumeAuthorizationCode({
          state: callback.state,
          nonce,
          authorization_code: callback.code,
        });

        // Step 5: Register B account with its token
        const accountEntry: MultiAccountEntry = {
          id: account.id,
          acct: account.acct,
          displayName: account.display_name || account.username,
          avatar: account.avatar || account.avatar_static,
          encryptedTokenRef: '',
          lastUsedAt: new Date().toISOString(),
        };

        await dispatchThunk(dispatch, registerAccount(accountEntry, token));

        // Step 6: Restore original account's session by reloading the page
        // The session cookie was changed by the popup login, so we need to reload
        // to restore the original account's session from the stored token
        window.location.reload();
      } catch (error: unknown) {
        console.error('Account registration failed:', error);

        const knownMessage =
          error instanceof Error
            ? knownErrorMessages[error.message]
            : undefined;
        const message =
          knownMessage ??
          (error instanceof Error ? error.message : messages.addError);

        dispatch(showAlert({ message }));
      } finally {
        setIsProcessing(false);
      }
    };

    void add();
  }, [currentAccount, dispatch, intl]);

  const handleLogOutAllAccounts = useCallback(() => {
    const logOutAll = async () => {
      if (isLoggingOutAll) return;
      setIsLoggingOutAll(true);
      try {
        await clearAllAccounts();
        clearActiveAccountIdInStorage();
        setPersistedAccounts([]);
        await logOut();
      } catch (error: unknown) {
        console.error('Failed to log out of all accounts:', error);
        dispatch(
          showAlert({
            message: intl.formatMessage(messages.manageLogoutAllError),
          }),
        );
      } finally {
        setIsLoggingOutAll(false);
      }
    };
    void logOutAll();
  }, [dispatch, intl, isLoggingOutAll]);

  if (!currentAccount) return null;

  const renderManageModal = () => {
    if (!isManageOpen) return null;

    const handleOverlayClick = () => {
      handleCloseManage();
    };

    const stopPropagation = (event: ReactMouseEvent) => {
      event.stopPropagation();
    };

    const hasManagedAccounts = managedAccounts.length > 0;

    return createPortal(
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
      <div
        className='account-switcher__manage-overlay'
        role='dialog'
        aria-modal='true'
        aria-labelledby='account-switcher-manage-title'
        onClick={handleOverlayClick}
      >
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
        <div
          className='account-switcher__manage-modal'
          onClick={stopPropagation}
        >
          <div className='account-switcher__manage-header'>
            <button
              type='button'
              className='account-switcher__manage-close'
              onClick={handleCloseManage}
              aria-label={intl.formatMessage(messages.manageDeleteCancel)}
            >
              <Icon id='close' icon={CloseIcon} />
            </button>
            <h2
              id='account-switcher-manage-title'
              className='account-switcher__manage-title'
            >
              {intl.formatMessage(messages.manageTitle)}
            </h2>
          </div>

          <div className='account-switcher__manage-list'>
            {managedAccounts.length === 0 ? (
              <div className='account-switcher__manage-empty'>
                {intl.formatMessage(messages.manageEmpty)}
              </div>
            ) : (
              managedAccounts.map((entry) => {
                const isActive = entry.id === activeAccountId;
                const isCurrentLoggedIn =
                  entry.id === (currentAccount.get('id') as string | undefined);
                const isDeleting = deletingAccountId === entry.id;
                const canSwitch = !(
                  isActive ||
                  isCurrentLoggedIn ||
                  isDeleting ||
                  isProcessing
                );

                const handleItemClick = () => {
                  if (!canSwitch) return;
                  void handleSwitchAccount(entry.id);
                };

                const handleItemKeyDown = (
                  event: ReactKeyboardEvent<HTMLDivElement>,
                ) => {
                  if (!canSwitch) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void handleSwitchAccount(entry.id);
                  }
                };

                return (
                  <div
                    key={entry.id}
                    className={`account-switcher__manage-item${isActive ? ' account-switcher__manage-item--active' : ''}`}
                    role='button'
                    tabIndex={0}
                    onClick={handleItemClick}
                    onKeyDown={handleItemKeyDown}
                    aria-disabled={!canSwitch}
                  >
                    <img
                      src={entry.avatar || ''}
                      alt=''
                      className='account-switcher__manage-avatar'
                      draggable={false}
                    />
                    <div className='account-switcher__manage-info'>
                      <span className='account-switcher__manage-name'>
                        {entry.displayName || entry.acct || entry.id}
                      </span>
                      <span className='account-switcher__manage-handle'>
                        @{entry.acct || entry.id}
                      </span>
                    </div>
                    <div className='account-switcher__manage-actions'>
                      {(isActive || isCurrentLoggedIn) && (
                        <span
                          className='account-switcher__manage-status'
                          aria-hidden
                        >
                          <Icon
                            id='check'
                            icon={CheckIcon}
                            className='account-switcher__manage-check'
                          />
                        </span>
                      )}
                      {!isCurrentLoggedIn && (
                        <button
                          type='button'
                          className='account-switcher__manage-action account-switcher__manage-action--danger'
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRequestDelete(entry);
                          }}
                          disabled={isDeleting}
                          aria-label={intl.formatMessage(messages.manageDelete)}
                        >
                          <Icon id='delete' icon={DeleteIcon} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {hasManagedAccounts && (
              <div
                className='account-switcher__manage-divider'
                aria-hidden='true'
              />
            )}
          </div>

          <div className='account-switcher__manage-footer'>
            <button
              type='button'
              className='account-switcher__manage-footer-button account-switcher__manage-footer-button--ghost account-switcher__manage-footer-button--link'
              onClick={handleAddAccount}
              disabled={isProcessing || isLoggingOutAll}
            >
              {intl.formatMessage(messages.manageAddExisting)}
            </button>
            <button
              type='button'
              className='account-switcher__manage-footer-button account-switcher__manage-footer-button--ghost account-switcher__manage-footer-button--danger'
              onClick={handleLogOutAllAccounts}
              disabled={isProcessing || isLoggingOutAll}
            >
              {isLoggingOutAll ? (
                <CircularProgress size={16} strokeWidth={3} />
              ) : (
                intl.formatMessage(messages.manageLogoutAll)
              )}
            </button>
          </div>
        </div>

        {pendingDeletion && (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
          <div
            className='account-switcher__confirm-overlay'
            role='dialog'
            aria-modal='true'
            aria-labelledby='account-switcher-confirm-title'
            onClick={stopPropagation}
          >
            <div className='account-switcher__confirm-modal'>
              <h3 id='account-switcher-confirm-title'>
                {intl.formatMessage(messages.manageDeleteConfirmTitle, {
                  displayName:
                    pendingDeletion.displayName ||
                    pendingDeletion.acct ||
                    pendingDeletion.id,
                })}
              </h3>
              <p>
                {intl.formatMessage(messages.manageDeleteConfirmDescription)}
              </p>
              <div className='account-switcher__confirm-actions'>
                <button
                  type='button'
                  onClick={handleCancelDelete}
                  className='account-switcher__confirm-button'
                  disabled={deletingAccountId === pendingDeletion.id}
                >
                  {intl.formatMessage(messages.manageDeleteCancel)}
                </button>
                <button
                  type='button'
                  onClick={() => void handleConfirmDelete(pendingDeletion)}
                  className='account-switcher__confirm-button account-switcher__confirm-button--danger'
                  disabled={deletingAccountId === pendingDeletion.id}
                >
                  {deletingAccountId === pendingDeletion.id ? (
                    <CircularProgress size={14} strokeWidth={3} />
                  ) : (
                    intl.formatMessage(messages.manageDeleteConfirm)
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>,
      document.body,
    );
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger({ openManage: handleOpenManageFromTrigger })
      ) : (
        <div className='account-switcher navigation-panel__account-switcher'>
          <div className='account-switcher__trigger-wrapper'>
            <button
              type='button'
              className='account-switcher__trigger'
              onClick={handleOpenManageFromTrigger}
              aria-haspopup='dialog'
              aria-label={intl.formatMessage(messages.switchAccount)}
            >
              {intl.formatMessage(messages.switchAccount)}
            </button>
          </div>
        </div>
      )}

      {renderManageModal()}
    </>
  );
};

import { useCallback } from 'react';

import { useHistory } from 'react-router-dom';

import { directCompose } from '@/mastodon/actions/compose';
import { createChatRoom } from '@/mastodon/actions/dm';
import type { Account } from '@/mastodon/models/account';
import { useAppDispatch } from '@/mastodon/store';

export function useDirectMessage(account?: Account) {
  const dispatch = useAppDispatch();
  const history = useHistory();

  return useCallback(() => {
    if (!account) return;

    if (account.acct !== account.username) {
      dispatch(directCompose(account));
      return;
    }

    void dispatch(createChatRoom({ account_ids: [account.id] }))
      .then((room) => {
        history.push(`/direct_message/${room.uuid}`);
      })
      .catch(() => {
        dispatch(directCompose(account));
      });
  }, [account, dispatch, history]);
}

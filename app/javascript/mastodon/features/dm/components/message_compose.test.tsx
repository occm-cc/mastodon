import { cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { MessageCompose } from './message_compose';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  sendMessage: vi.fn(() => ({ type: 'TEST_SEND' })),
}));
vi.mock('mastodon/store', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('mastodon/actions/dm', () => ({ sendMessage: mocks.sendMessage }));
vi.mock('mastodon/features/emoji/emoji_picker', () => ({ Picker: () => null }));

describe('DM composer keyboard input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('sends with Enter using the existing DM action', () => {
    render(<MessageCompose roomId='existing-room' />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '안녕하세요' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mocks.sendMessage).toHaveBeenCalledWith('existing-room', {
      content: '안녕하세요',
    });
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it('does not submit during Korean IME composition or Shift+Enter', () => {
    render(<MessageCompose roomId='existing-room' />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '작성 중' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});

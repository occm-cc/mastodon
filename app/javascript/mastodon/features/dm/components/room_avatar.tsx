// Overlapping group avatars adapted from 한참 (@_longwhile), longwhile-mastodon (AGPLv3).
import { me } from 'mastodon/initial_state';
import type { DmChatRoomParticipant } from 'mastodon/reducers/dm';

export const RoomAvatar: React.FC<{
  participants: DmChatRoomParticipant[];
  isGroup: boolean;
  size: number;
}> = ({ participants, isGroup, size }) => {
  const others = participants.filter((account) => account.id !== me);
  const accounts = (others.length > 0 ? others : participants).slice(
    0,
    isGroup ? 2 : 1,
  );

  return (
    <span
      className={`dm-room-avatar ${accounts.length > 1 ? 'dm-room-avatar--group' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {accounts.length === 0 && (
        <span className='dm-room-avatar__placeholder' />
      )}
      {accounts.map((account) =>
        account.avatar_static ? (
          <img key={account.id} src={account.avatar_static} alt='' />
        ) : (
          <span key={account.id} className='dm-room-avatar__placeholder' />
        ),
      )}
    </span>
  );
};

// Who's on this board right now. Entries are per connection, so the same
// person in two tabs shows up twice (expected; see spec Step 9).
export default function OnlineUsers({ users, selfId, onRename }) {
  return (
    <aside className="online-users" aria-label="Online users">
      <h2>{users.length} online</h2>
      <ul>
        {users.map((user) => {
          const isSelf = user.socketId === selfId;
          const label = (
            <>
              <span className="user-dot" style={{ background: user.color }} aria-hidden="true" />
              <span className="user-name">{user.name}</span>
              {isSelf && <span className="user-you">(you)</span>}
            </>
          );
          return (
            <li key={user.socketId}>
              {isSelf ? (
                <button type="button" className="user-row self" title="Change your name" onClick={onRename}>
                  {label}
                </button>
              ) : (
                <span className="user-row">{label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

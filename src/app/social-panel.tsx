"use client";

import { DoorOpen, MessageCircle, Pencil, Plus, Send, Smile, UserPlus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/trpc/client";

const EMOJIS = ["🙂", "🔥", "👍", "🎯", "💪", "😄", "🤝", "🏆"];

type Room = {
  roomId: string;
  name: string;
  type: "global" | "room" | "direct";
  joined: boolean;
};

export default function SocialPanel() {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [notice, setNotice] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const profile = trpc.social.me.useQuery();
  const rooms = trpc.social.rooms.useQuery(undefined, {
    refetchInterval: 2500
  });
  const friends = trpc.social.friends.useQuery(undefined, {
    refetchInterval: 3500
  });
  const friendRequests = trpc.social.friendRequests.useQuery(undefined, {
    refetchInterval: 3500
  });

  const joinedRooms = useMemo(() => rooms.data?.joined ?? [], [rooms.data?.joined]);
  const availableRooms = useMemo(() => rooms.data?.available ?? [], [rooms.data?.available]);
  const activeRoom = useMemo(
    () => joinedRooms.find((room) => room.roomId === activeRoomId) ?? joinedRooms[0] ?? null,
    [activeRoomId, joinedRooms]
  );

  const messages = trpc.social.messages.useQuery(
    { roomId: activeRoom?.roomId ?? "" },
    {
      enabled: Boolean(activeRoom),
      refetchInterval: 1200
    }
  );

  const updateProfile = trpc.social.updateProfile.useMutation({
    onSuccess: () => {
      setNotice("Аватар обновлен.");
      setAvatarUrl("");
      void profile.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const createRoom = trpc.social.createRoom.useMutation({
    onSuccess: ({ roomId }) => {
      setActiveRoomId(roomId);
      setRoomName("");
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const createGroupRoom = trpc.social.createGroupRoom.useMutation({
    onSuccess: ({ roomId }) => {
      setActiveRoomId(roomId);
      setGroupName("");
      setSelectedFriendIds([]);
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const joinRoom = trpc.social.joinRoom.useMutation({
    onSuccess: ({ roomId }) => {
      setActiveRoomId(roomId);
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const leaveRoom = trpc.social.leaveRoom.useMutation({
    onSuccess: ({ roomId }) => {
      if (activeRoomId === roomId) {
        setActiveRoomId(null);
      }
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const sendMessage = trpc.social.sendMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      void messages.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const addFriend = trpc.social.addFriend.useMutation({
    onSuccess: () => {
      setFriendIdentifier("");
      setNotice("Заявка в друзья отправлена.");
      void friends.refetch();
      void friendRequests.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const acceptFriend = trpc.social.acceptFriend.useMutation({
    onSuccess: () => {
      setNotice("Заявка принята.");
      void friends.refetch();
      void friendRequests.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const rejectFriend = trpc.social.rejectFriend.useMutation({
    onSuccess: () => {
      void friendRequests.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const cancelFriendRequest = trpc.social.cancelFriendRequest.useMutation({
    onSuccess: () => {
      void friendRequests.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const removeFriend = trpc.social.removeFriend.useMutation({
    onSuccess: () => {
      void friends.refetch();
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const openDirectRoom = trpc.social.openDirectRoom.useMutation({
    onSuccess: ({ roomId }) => {
      setActiveRoomId(roomId);
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const renameRoom = trpc.social.renameRoom.useMutation({
    onSuccess: () => {
      setNotice("Комната переименована.");
      setEditingRoomId(null);
      setEditingName("");
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });
  const renameDirectChat = trpc.social.renameDirectChat.useMutation({
    onSuccess: () => {
      setNotice("Чат переименован.");
      setEditingRoomId(null);
      setEditingName("");
      void rooms.refetch();
    },
    onError: (error) => setNotice(error.message)
  });

  function handleSend() {
    if (!activeRoom || !message.trim()) {
      return;
    }
    sendMessage.mutate({ roomId: activeRoom.roomId, body: message });
  }

  function roomTitle(room: Room) {
    if (room.type === "global") {
      return "Общий чат";
    }
    if (room.type === "direct") {
      return room.name;
    }
    return room.name;
  }

  function toggleGroupFriend(friendId: string) {
    setSelectedFriendIds((current) =>
      current.includes(friendId) ? current.filter((entry) => entry !== friendId) : [...current, friendId]
    );
  }

  function startEditing(room: Room) {
    setEditingRoomId(room.roomId);
    setEditingName(room.name);
  }

  function saveEditing() {
    if (!editingRoomId || !editingName.trim()) {
      return;
    }
    const activeRoom = joinedRooms.find((r) => r.roomId === editingRoomId);
    if (activeRoom?.type === "direct") {
      renameDirectChat.mutate({ roomId: editingRoomId, customName: editingName.trim() });
    } else {
      renameRoom.mutate({ roomId: editingRoomId, name: editingName.trim() });
    }
  }

  function cancelEditing() {
    setEditingRoomId(null);
    setEditingName("");
  }

  return (
    <section className="social-panel">
      <div className="panel-title">
        <MessageCircle size={18} />
        <h2>Общение</h2>
      </div>

      <div className="profile-card">
        <Avatar src={profile.data?.image} name={profile.data?.name ?? "Игрок"} />
        <div>
          <strong>{profile.data?.name ?? "Игрок"}</strong>
          <span>{profile.data?.email}</span>
        </div>
      </div>

      <div className="compact-form">
        <input
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="Ссылка на аватар"
          value={avatarUrl}
        />
        <button className="secondary" onClick={() => updateProfile.mutate({ image: avatarUrl })} type="button">
          Сохранить
        </button>
      </div>

      <div className="social-block">
        <div className="social-block-head">
          <strong>
            <Users size={16} /> Комнаты
          </strong>
        </div>
        <div className="compact-form">
          <input onChange={(event) => setRoomName(event.target.value)} placeholder="Название комнаты" value={roomName} />
          <button className="secondary icon-only" onClick={() => createRoom.mutate({ name: roomName })} title="Создать комнату" type="button">
            <Plus size={16} />
          </button>
        </div>

        <div className="group-chat-builder">
          <input onChange={(event) => setGroupName(event.target.value)} placeholder="Название группового чата" value={groupName} />
          <div className="friend-picker">
            {friends.data?.length ? (
              friends.data.map((friend) => (
                <label className="picker-row" key={friend.friendId}>
                  <input
                    checked={selectedFriendIds.includes(friend.friendId)}
                    onChange={() => toggleGroupFriend(friend.friendId)}
                    type="checkbox"
                  />
                  <span>{friend.name}</span>
                </label>
              ))
            ) : (
              <p className="field-hint">Для группового чата сначала добавьте друзей.</p>
            )}
          </div>
          <button
            className="secondary wide"
            disabled={!groupName.trim() || selectedFriendIds.length === 0}
            onClick={() => createGroupRoom.mutate({ name: groupName, friendIds: selectedFriendIds })}
            type="button"
          >
            <Plus size={16} /> Создать групповой чат
          </button>
        </div>

        <div className="room-list">
          {joinedRooms.map((room) => (
            <div key={room.roomId} className="room-item">
              {editingRoomId === room.roomId ? (
                <div className="edit-form">
                  <input
                    onChange={(event) => setEditingName(event.target.value)}
                    placeholder="Новое название"
                    value={editingName}
                    autoFocus
                  />
                  <button className="primary icon-only" onClick={saveEditing} title="Сохранить" type="button">
                    <Send size={14} />
                  </button>
                  <button className="secondary icon-only" onClick={cancelEditing} title="Отмена" type="button">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    className={activeRoom?.roomId === room.roomId ? "room-chip active" : "room-chip"}
                    onClick={() => setActiveRoomId(room.roomId)}
                    type="button"
                  >
                    {roomTitle(room)}
                  </button>
                  {room.type !== "global" && (
                    <button
                      className="secondary icon-only small"
                      onClick={() => startEditing(room)}
                      title="Переименовать"
                      type="button"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {availableRooms.map((room) => (
            <button className="room-chip muted" key={room.roomId} onClick={() => joinRoom.mutate({ roomId: room.roomId })} type="button">
              <DoorOpen size={14} /> Войти: {roomTitle(room)}
            </button>
          ))}
        </div>
      </div>

      {activeRoom ? (
        <div className="chat-box">
          <div className="chat-head">
            <strong>{roomTitle(activeRoom)}</strong>
            <button className="secondary icon-only" onClick={() => leaveRoom.mutate({ roomId: activeRoom.roomId })} title="Выйти из чата" type="button">
              <X size={16} />
            </button>
          </div>
          <div className="messages">
            {messages.data?.length ? (
              messages.data.map((entry) => (
                <div className={entry.mine ? "message mine" : "message"} key={entry.id}>
                  <Avatar src={entry.authorImage} name={entry.authorName} small />
                  <div>
                    <strong>{entry.authorName}</strong>
                    <p>{entry.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="field-hint">Сообщений пока нет.</p>
            )}
          </div>
          <div className="emoji-row" aria-label="Смайлики">
            {EMOJIS.map((emoji) => (
              <button className="emoji-button" key={emoji} onClick={() => setMessage((current) => `${current}${emoji}`)} type="button">
                {emoji}
              </button>
            ))}
          </div>
          <div className="chat-input">
            <input
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSend();
                }
              }}
              placeholder="Написать сообщение"
              value={message}
            />
            <button className="primary icon-only" onClick={handleSend} title="Отправить" type="button">
              <Send size={16} />
            </button>
          </div>
        </div>
      ) : (
        <p className="field-hint">Войдите в общий чат или создайте комнату.</p>
      )}

      <div className="social-block">
        <div className="social-block-head">
          <strong>
            <Smile size={16} /> Друзья
          </strong>
        </div>
        <div className="compact-form">
          <input
            onChange={(event) => setFriendIdentifier(event.target.value)}
            placeholder="Email или никнейм"
            value={friendIdentifier}
          />
          <button className="secondary icon-only" onClick={() => addFriend.mutate({ identifier: friendIdentifier })} title="Добавить друга" type="button">
            <UserPlus size={16} />
          </button>
        </div>

        {friendRequests.data?.incoming.length ? (
          <div className="request-list">
            <strong>Входящие заявки</strong>
            {friendRequests.data.incoming.map((request) => (
              <div className="friend-row" key={request.id}>
                <Avatar src={request.image} name={request.name} small />
                <span className="friend-name">{request.name}</span>
                <div className="mini-actions">
                  <button className="secondary" onClick={() => acceptFriend.mutate({ requestId: request.id })} type="button">
                    Принять
                  </button>
                  <button className="secondary icon-only" onClick={() => rejectFriend.mutate({ requestId: request.id })} title="Отклонить" type="button">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {friendRequests.data?.outgoing.length ? (
          <div className="request-list">
            <strong>Исходящие заявки</strong>
            {friendRequests.data.outgoing.map((request) => (
              <div className="friend-row" key={request.id}>
                <Avatar src={request.image} name={request.name} small />
                <span className="friend-name">{request.name}</span>
                <button className="secondary icon-only" onClick={() => cancelFriendRequest.mutate({ requestId: request.id })} title="Отменить заявку" type="button">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="friend-list">
          {friends.data?.length ? (
            friends.data.map((friend) => (
              <div className="friend-row" key={friend.friendId}>
                <Avatar src={friend.image} name={friend.name} small />
                <button className="friend-name" onClick={() => openDirectRoom.mutate({ friendId: friend.friendId })} type="button">
                  {friend.name}
                </button>
                <button className="secondary icon-only" onClick={() => removeFriend.mutate({ friendId: friend.friendId })} title="Удалить друга" type="button">
                  <X size={14} />
                </button>
              </div>
            ))
          ) : (
            <p className="field-hint">Добавьте друга по email или никнейму.</p>
          )}
        </div>
      </div>

      {notice && <p className="field-hint">{notice}</p>}
    </section>
  );
}

function Avatar({ src, name, small = false }: { src?: string | null; name: string; small?: boolean }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className={small ? "avatar small" : "avatar"} src={src} />
  ) : (
    <span className={small ? "avatar small" : "avatar"}>{initials || "?"}</span>
  );
}

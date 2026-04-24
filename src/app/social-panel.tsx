"use client";

import { DoorOpen, MessageCircle, Plus, Send, Smile, UserPlus, Users, X } from "lucide-react";
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
  const utils = trpc.useUtils();
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [message, setMessage] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [notice, setNotice] = useState("");

  const profile = trpc.social.me.useQuery();
  const rooms = trpc.social.rooms.useQuery(undefined, {
    refetchInterval: 2500
  });
  const friends = trpc.social.friends.useQuery(undefined, {
    refetchInterval: 3500
  });

  const joinedRooms = rooms.data?.joined ?? [];
  const availableRooms = rooms.data?.available ?? [];
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
      setNotice("Друг добавлен.");
      void friends.refetch();
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
      return "Личные сообщения";
    }
    return room.name;
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

        <div className="room-list">
          {joinedRooms.map((room) => (
            <button
              className={activeRoom?.roomId === room.roomId ? "room-chip active" : "room-chip"}
              key={room.roomId}
              onClick={() => setActiveRoomId(room.roomId)}
              type="button"
            >
              {roomTitle(room)}
            </button>
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

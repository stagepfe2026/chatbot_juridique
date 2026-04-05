from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


# Gere les connexions WebSocket et la diffusion des notifications de reclamations.
class ClaimsNotificationHub:
    # Initialise les groupes de sockets admin et utilisateur.
    def __init__(self) -> None:
        self._admin_sockets: set[WebSocket] = set()
        self._user_sockets: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    # Accepte et enregistre une connexion WebSocket admin.
    async def connect_admin(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._admin_sockets.add(websocket)

    # Accepte et rattache une connexion WebSocket a un utilisateur donne.
    async def connect_user(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self._user_sockets[user_id].add(websocket)

    # Nettoie une connexion fermee des listes admin et utilisateur.
    async def disconnect(self, websocket: WebSocket, user_id: str | None = None) -> None:
        async with self._lock:
            self._admin_sockets.discard(websocket)
            if user_id:
                sockets = self._user_sockets.get(user_id)
                if sockets:
                    sockets.discard(websocket)
                    if not sockets:
                        self._user_sockets.pop(user_id, None)
            else:
                empty_user_ids: list[str] = []
                for uid, sockets in self._user_sockets.items():
                    sockets.discard(websocket)
                    if not sockets:
                        empty_user_ids.append(uid)
                for uid in empty_user_ids:
                    self._user_sockets.pop(uid, None)

    # Diffuse une notification a tous les administrateurs connectes.
    async def notify_admins(self, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._admin_sockets)
        await self._broadcast(targets, payload)

    # Diffuse une notification a tous les sockets d'un utilisateur donne.
    async def notify_user(self, user_id: str, payload: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._user_sockets.get(user_id, set()))
        await self._broadcast(targets, payload)

    # Envoie une charge utile a plusieurs sockets puis retire celles qui ont deconnecte.
    async def _broadcast(self, sockets: list[WebSocket], payload: dict[str, Any]) -> None:
        disconnected: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                disconnected.append(socket)

        if disconnected:
            async with self._lock:
                for socket in disconnected:
                    self._admin_sockets.discard(socket)
                empty_user_ids: list[str] = []
                for uid, user_sockets in self._user_sockets.items():
                    for socket in disconnected:
                        user_sockets.discard(socket)
                    if not user_sockets:
                        empty_user_ids.append(uid)
                for uid in empty_user_ids:
                    self._user_sockets.pop(uid, None)


claims_notifications_hub = ClaimsNotificationHub()

from pathlib import Path
import sys

# Permet d'executer le script depuis le dossier backend.
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.security import hash_password
from app.models import UserRole
from app.repositories import UsersRepository


def seed_users() -> None:
    repo = UsersRepository()
    repo.ensure_indexes()

    users = [
        {
            "nom": "Hatem",
            "prenom": "Abidi",
            "email": "hatem_abidi@CIMF.local",
            "password": "password123",
            "role": UserRole.ADMIN.value,
        },
        {
            "nom": "Noah",
            "prenom": "Ben othmen",
            "email": "noah_ben_othmen@CIMF.local",
            "password": "password123",
            "role": UserRole.FINANCE_USER.value,
        },
    ]

    for user in users:
        user_id = repo.upsert_user(
            nom=user["nom"],
            prenom=user["prenom"],
            email=user["email"],
            password_hash=hash_password(user["password"]),
            role=user["role"],
        )
        print(f"[seed] user={user['email']} role={user['role']} id={user_id}")

    print("\nCredentials de test:")
    print("- hatem_abidi@CIMF.local / password123 (ADMIN)")
    print("- noah_ben_othmen@CIMF.local / password123 (FINANCE_USER)")


if __name__ == "__main__":
    seed_users()

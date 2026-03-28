from datetime import datetime, timezone
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
            "nom": "Abidi",
            "prenom": "Hatem",
            "email": "hatem_abidi@cimf.local",
            "password": "password123",
            "role": UserRole.ADMIN.value,
            "telephone": "+216 71 222 110",
            "profile_image_url": "https://randomuser.me/api/portraits/men/46.jpg",
            "adresse": "Avenue Habib Bourguiba, Tunis",
            "date_naissance": "1983-04-11",
            "direction": "Direction generale des impots",
            "service": "Service pilotage et coordination numerique",
            "poste": "Administrateur de plateforme",
            "matricule": "MAT-ADM-2024-0001",
            "bureau": "Batiment A, Bureau 201",
            "responsable": "Secretaire general des finances",
            "membre_depuis": "2018-01-15",
            "langue_preferee": "fr",
            "theme_prefere": "light",
            "notifications_email": True,
            "notifications_sms": True,
            "two_factor_enabled": True,
            "password_updated_at": datetime(2026, 3, 12, 8, 30, tzinfo=timezone.utc),
        },
        {
            "nom": "Ben Ali",
            "prenom": "Ahmed",
            "email": "ahmed_benali@cimf.local",
            "password": "password123",
            "role": UserRole.FINANCE_USER.value,
            "telephone": "+212 537 67 89 00",
            "profile_image_url": "https://randomuser.me/api/portraits/men/32.jpg",
            "adresse": "Boulevard Mohammed V, Rabat",
            "date_naissance": "1985-01-15",
            "direction": "Direction du Budget",
            "service": "Service analyse budgetaire",
            "poste": "Directeur Adjoint",
            "matricule": "MAT-2024-12345",
            "bureau": "Batiment B, Bureau 304",
            "responsable": "Fatima Zahra El Amrani",
            "membre_depuis": "2015-09-01",
            "langue_preferee": "fr",
            "theme_prefere": "light",
            "notifications_email": True,
            "notifications_sms": False,
            "two_factor_enabled": True,
            "password_updated_at": datetime(2026, 3, 12, 7, 0, tzinfo=timezone.utc),
        },
    ]

    for user in users:
        user_id = repo.upsert_user(
            nom=user["nom"],
            prenom=user["prenom"],
            email=user["email"],
            password_hash=hash_password(user["password"]),
            role=user["role"],
            telephone=user["telephone"],
            profile_image_url=user["profile_image_url"],
            adresse=user["adresse"],
            date_naissance=user["date_naissance"],
            direction=user["direction"],
            service=user["service"],
            poste=user["poste"],
            matricule=user["matricule"],
            bureau=user["bureau"],
            responsable=user["responsable"],
            membre_depuis=user["membre_depuis"],
            langue_preferee=user["langue_preferee"],
            theme_prefere=user["theme_prefere"],
            notifications_email=user["notifications_email"],
            notifications_sms=user["notifications_sms"],
            two_factor_enabled=user["two_factor_enabled"],
            password_updated_at=user["password_updated_at"],
        )
        print(f"[seed] user={user['email']} role={user['role']} id={user_id}")

    print("\nCredentials de test:")
    print("- hatem_abidi@cimf.local / password123 (ADMIN)")
    print("- ahmed_benali@cimf.local / password123 (FINANCE_USER)")


if __name__ == "__main__":
    seed_users()

#!/usr/bin/env python
"""
Setup script to initialize the database and seed with test data.
Run this after setting up your .env file with DATABASE_URL or DB_* variables.
"""
import os
import sys
import django
from pathlib import Path

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kicowasco.settings')
sys.path.insert(0, str(Path(__file__).parent / 'kicowasco'))

django.setup()

from django.core.management import call_command

def main():
    print("=" * 70)
    print("KICOWASCO Database Setup & Seeding")
    print("=" * 70)
    
    # Step 1: Run migrations
    print("\n[1/3] Running database migrations...")
    try:
        call_command('migrate')
        print("✓ Migrations completed successfully")
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        return False
    
    # Step 2: Create superuser (if needed)
    print("\n[2/3] Ensuring admin user exists...")
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        admin_user = User.objects.filter(username='admin').first()
        if not admin_user:
            admin_user = User.objects.create_superuser(
                username='admin',
                email='admin@kicowasco.co.ke',
                password='admin123'
            )
            if hasattr(admin_user, 'role'):
                admin_user.role = 'admin'
                admin_user.save(update_fields=['role'])
            print("✓ Admin user created (username: admin, password: admin123)")
        else:
            fields_to_update = []
            if hasattr(admin_user, 'role') and admin_user.role != 'admin':
                admin_user.role = 'admin'
                fields_to_update.append('role')
            if not admin_user.is_staff:
                admin_user.is_staff = True
                fields_to_update.append('is_staff')
            if not admin_user.is_superuser:
                admin_user.is_superuser = True
                fields_to_update.append('is_superuser')
            if not admin_user.is_active:
                admin_user.is_active = True
                fields_to_update.append('is_active')
            if fields_to_update:
                admin_user.save(update_fields=fields_to_update)
            print("✓ Admin user already exists")
    except Exception as e:
        print(f"✗ Admin user creation failed: {e}")
        return False
    
    # Step 3: Seed database
    print("\n[3/3] Seeding database with 90 days of test data...")
    try:
        call_command('seed_db')
        print("✓ Database seeded successfully")
    except Exception as e:
        print(f"✗ Seeding failed: {e}")
        return False
    
    print("\n" + "=" * 70)
    print("✓ Setup Complete!")
    print("=" * 70)
    print("\nYou can now:")
    print("  1. Start the Django development server:")
    print("     python kicowasco/manage.py runserver")
    print("  2. Access the API at http://localhost:8000/api/")
    print("  3. Login with admin/admin123")
    print("\n" + "=" * 70)
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)

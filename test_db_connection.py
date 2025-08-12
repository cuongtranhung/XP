#!/usr/bin/env python3
"""
PostgreSQL Database Connection Test
Tests connection to PostgreSQL database with provided credentials
"""

import psycopg2
import sys
from psycopg2 import OperationalError

def test_postgresql_connection():
    """Test PostgreSQL database connection"""
    
    # Test multiple port configurations
    test_configs = [
        {
            'host': '192.168.5.3',
            'port': 8080,
            'database': 'postgres',
            'user': 'postgres',
            'password': '@abcd1234'
        },
        {
            'host': '192.168.5.3',
            'port': 5432,  # Standard PostgreSQL port
            'database': 'postgres',
            'user': 'postgres',
            'password': '@abcd1234'
        }
    ]
    
    for i, connection_params in enumerate(test_configs, 1):
        print(f"\n=== Configuration {i} ===")
        print("Testing PostgreSQL connection...")
        print(f"Host: {connection_params['host']}")
        print(f"Port: {connection_params['port']}")
        print(f"User: {connection_params['user']}")
        print(f"Database: {connection_params['database']}")
        print("-" * 50)
        
        try:
            # Attempt to establish connection
            print("Connecting to database...")
            connection = psycopg2.connect(**connection_params)
            
            # Create a cursor to perform database operations
            cursor = connection.cursor()
            
            # Test the connection with a simple query
            cursor.execute("SELECT version();")
            db_version = cursor.fetchone()
            
            print("✅ Connection successful!")
            print(f"PostgreSQL version: {db_version[0]}")
            
            # Test basic database operations
            cursor.execute("SELECT current_database(), current_user, inet_server_addr(), inet_server_port();")
            db_info = cursor.fetchone()
            
            print(f"Current database: {db_info[0]}")
            print(f"Current user: {db_info[1]}")
            print(f"Server address: {db_info[2]}")
            print(f"Server port: {db_info[3]}")
            
            # List available databases
            cursor.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
            databases = cursor.fetchall()
            print(f"Available databases: {[db[0] for db in databases]}")
            
            cursor.close()
            connection.close()
            print("✅ Connection closed successfully")
            return True
            
        except OperationalError as e:
            print("❌ Connection failed!")
            print(f"Error: {e}")
            
            # Common error analysis
            error_msg = str(e).lower()
            if "could not connect to server" in error_msg:
                print("\n🔍 Troubleshooting suggestions:")
                print("- Check if PostgreSQL server is running")
                print(f"- Verify the host address ({connection_params['host']})")
                print(f"- Confirm the port number ({connection_params['port']})")
                print("- Check firewall settings")
            elif "authentication failed" in error_msg:
                print("\n🔍 Authentication issue:")
                print("- Verify username and password")
                print("- Check pg_hba.conf configuration")
            elif "database" in error_msg and "does not exist" in error_msg:
                print("\n🔍 Database issue:")
                print("- Try connecting to 'template1' or another database")
            
            if i < len(test_configs):
                print(f"Trying next configuration...")
                continue
            
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            if i < len(test_configs):
                print(f"Trying next configuration...")
                continue
    
    print("\n❌ All connection attempts failed!")
    return False

if __name__ == "__main__":
    try:
        success = test_postgresql_connection()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️ Connection test interrupted by user")
        sys.exit(1)
    except ImportError:
        print("❌ psycopg2 library not found!")
        print("Install it with: pip install psycopg2-binary")
        sys.exit(1)
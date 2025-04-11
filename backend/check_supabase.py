import os
from dotenv import load_dotenv
from supabase import create_client, Client
import traceback

# Load environment variables
load_dotenv()

# Get Supabase credentials
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

print("== Supabase Configuration Check ==")
print(f"SUPABASE_URL: {supabase_url}")
print(f"SUPABASE_KEY (first 10 chars): {supabase_key[:10] if supabase_key else 'Not set'}")
print(f"SUPABASE_KEY length: {len(supabase_key) if supabase_key else 0}")

# Try to connect to Supabase
try:
    print("\nAttempting to connect to Supabase...")
    if not supabase_url or not supabase_key:
        print("ERROR: Supabase credentials are not set properly in .env file")
    else:
        supabase = create_client(supabase_url, supabase_key)
        print("Successfully created Supabase client")
        
        # Try to query the 'predictions' table
        try:
            print("\nTesting query to 'predictions' table...")
            result = supabase.table("predictions").select("*").limit(1).execute()
            if hasattr(result, 'data'):
                print(f"Query successful! Found {len(result.data)} records")
                if len(result.data) > 0:
                    print(f"Sample record: {result.data[0]}")
                else:
                    print("No records found in the 'predictions' table")
            else:
                print("Query returned no data attribute")
        except Exception as e:
            print(f"Error querying 'predictions' table: {str(e)}")
            print(traceback.format_exc())
except Exception as e:
    print(f"Error connecting to Supabase: {str(e)}")
    print(traceback.format_exc()) 
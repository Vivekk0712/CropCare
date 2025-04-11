import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
import time
import traceback

def setup_supabase():
    # Load environment variables
    load_dotenv()
    
    # Get Supabase credentials
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")
    
    print("== Supabase Database Setup ==")
    print(f"SUPABASE_URL: {supabase_url}")
    print(f"SUPABASE_KEY (first 10 chars): {supabase_key[:10] if supabase_key else 'Not set'}")
    
    # Check if credentials are set
    if not supabase_url or not supabase_key:
        print("ERROR: Supabase credentials are not set properly in .env file")
        return False
    
    try:
        # Connect to Supabase
        print("\nConnecting to Supabase...")
        supabase = create_client(supabase_url, supabase_key)
        print("Successfully connected to Supabase")
        
        # Check if 'predictions' table exists by querying it
        try:
            print("\nChecking if 'predictions' table exists...")
            result = supabase.table("predictions").select("*").limit(1).execute()
            print("'predictions' table exists, no need to create it")
            return True
        except Exception as e:
            if "relation \"predictions\" does not exist" in str(e):
                print("'predictions' table doesn't exist, creating it now...")
                
                # For Supabase, we can't create tables directly through the API
                # Instead, we'll provide SQL to run in the Supabase SQL Editor
                print("\nTo create the 'predictions' table, run the following SQL in the Supabase SQL Editor:")
                print("=" * 80)
                print("""
CREATE TABLE public.predictions (
    id UUID PRIMARY KEY,
    user_id TEXT NOT NULL,
    image_name TEXT,
    image_data TEXT,
    prediction TEXT NOT NULL,
    confidence FLOAT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Set up Row Level Security
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to select
CREATE POLICY "Anyone can select from predictions" 
ON public.predictions FOR SELECT USING (true);

-- Create policy to allow anyone to insert
CREATE POLICY "Anyone can insert into predictions" 
ON public.predictions FOR INSERT WITH CHECK (true);

-- Create policy to allow users to update their own predictions
CREATE POLICY "Users can update own predictions" 
ON public.predictions FOR UPDATE USING (auth.uid()::text = user_id);

-- Create policy to allow users to delete their own predictions
CREATE POLICY "Users can delete own predictions" 
ON public.predictions FOR DELETE USING (auth.uid()::text = user_id);

-- Create index on user_id for faster queries
CREATE INDEX idx_predictions_user_id ON public.predictions(user_id);
                """)
                print("=" * 80)
                print("\nAfter creating the table, restart the application.")
                return False
            else:
                print(f"Error checking if table exists: {str(e)}")
                print(traceback.format_exc())
                return False
    
    except Exception as e:
        print(f"Error connecting to Supabase: {str(e)}")
        print(traceback.format_exc())
        return False

if __name__ == "__main__":
    if setup_supabase():
        print("\nDatabase setup successful!")
        sys.exit(0)
    else:
        print("\nDatabase setup incomplete. Please follow the instructions above.")
        sys.exit(1) 
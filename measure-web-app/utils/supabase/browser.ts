"use client";

import { createBrowserClient as createClient } from "@supabase/ssr"

export const createBrowserClient = () => createClient(process?.env?.NEXT_PUBLIC_SUPABASE_URL!, process?.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
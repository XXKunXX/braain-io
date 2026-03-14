import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { fileName, contentType } = await req.json();

  if (!fileName || !contentType) {
    return NextResponse.json({ error: "fileName und contentType erforderlich" }, { status: 400 });
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUploadUrl(uniqueName);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("attachments")
    .getPublicUrl(uniqueName);

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path: uniqueName, publicUrl });
}

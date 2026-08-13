import { revalidatePath } from "next/cache";
import { getLocaleSafe } from "@/lib/locale";

export async function revalidateWithLocale(path: string) {
  const locale = await getLocaleSafe();
  revalidatePath(`/${locale}${path}`);
}

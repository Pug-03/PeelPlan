import { getTranslations } from "next-intl/server";
import { NotFoundView, notFoundPrimary, notFoundSecondary } from "@/components/NotFoundView";
import { SiteHeader } from "@/components/SiteHeader";
import { Link } from "@/i18n/navigation";

/** Localised 404 inside the site layout (unknown paths reach it through `[...rest]`). */
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <>
      <SiteHeader />
      <main id="main">
        <NotFoundView
          title={t("title")}
          body={t("body")}
          actions={
            <>
              <Link href="/" className={notFoundPrimary}>
                {t("home")}
              </Link>
              <Link href="/editor" className={notFoundSecondary}>
                {t("editor")}
              </Link>
            </>
          }
        />
      </main>
    </>
  );
}

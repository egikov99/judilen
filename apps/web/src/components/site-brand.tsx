import Image from "next/image";
import Link from "next/link";

export function SiteBrand({
  href = "/",
  label = "База отдыха «Юдилен»",
  logoSrc = "/images/judilen-strusto-logo.png",
  className = "",
  priority = false
}: {
  href?: string;
  label?: string;
  logoSrc?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link className={`brand site-brand ${className}`.trim()} href={href}>
      <span className="site-brand-logo-frame">
        <Image
          className="site-brand-logo"
          src={logoSrc}
          width={48}
          height={48}
          alt="Логотип базы отдыха «Юдилен»"
          priority={priority}
        />
      </span>
      <span className="site-brand-label">{label}</span>
    </Link>
  );
}

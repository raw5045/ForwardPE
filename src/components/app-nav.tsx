import Link from "next/link";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/sp500", label: "S&P 500" },
  { href: "/instruments/NDX", label: "Nasdaq-100" },
  { href: "/instruments/QQQ", label: "QQQ" },
  { href: "/admin/data-health", label: "Data Health" },
  { href: "/methodology", label: "Methodology" }
];

export function AppNav() {
  return (
    <header className="app-nav">
      <Link className="brand" href="/">
        Forward P/E
      </Link>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

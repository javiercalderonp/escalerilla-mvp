import { Mail, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.532 5.853L.057 23.571a.75.75 0 0 0 .921.921l5.765-1.49A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.695 9.695 0 0 1-4.945-1.355l-.355-.213-3.68.951.977-3.572-.232-.368A9.696 9.696 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
    </svg>
  );
}

const quickLinks = [
  { href: "/ranking/hombres", label: "Ranking" },
  { href: "/fixture", label: "Partidos" },
  { href: "/disponibilidad", label: "Disponibilidad" },
  { href: "/reglamento", label: "Reglamento" },
];

const contactLinks = [
  {
    icon: WhatsAppIcon,
    label: "WhatsApp",
    href: "https://wa.me/56985882280",
    value: "+56 9 8588 2280",
  },
  {
    icon: Mail,
    label: "Email",
    href: "mailto:gerencia@golfladehesa.cl",
    value: "gerencia@golfladehesa.cl",
  },
  {
    icon: InstagramIcon,
    label: "Instagram",
    href: "https://www.instagram.com/ladehesagolf/",
    value: "@ladehesagolf",
  },
  {
    icon: MapPin,
    label: "Ubicación",
    href: "https://maps.google.com/?q=Camino+Club+de+Golf+2501+Lo+Barnechea+Santiago",
    value: "Camino Club de Golf 2501, Lo Barnechea",
  },
];

export function Footer() {
  return (
    <footer className="bg-[#060e17]">
      {/* Gradient accent line */}
      <div className="h-px bg-gradient-to-r from-[#b04d15] via-[#2563eb] to-[#16a34a]" />

      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Col 1 — Brand */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Club La Dehesa"
                width={36}
                height={36}
                className="object-contain"
              />
              <div className="flex flex-col leading-none">
                <span className="text-sm font-bold tracking-wide text-white">
                  CLUB DE GOLF LA DEHESA
                </span>
                <span className="text-[10px] font-bold tracking-widest text-[#b04d15]">
                  ESCALERILLA TENIS
                </span>
              </div>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/40">
              Plataforma oficial de la escalerilla de tenis del Club La Dehesa.
              Ranking, programación semanal y gestión de resultados.
            </p>
          </div>

          {/* Col 2 — Quick links */}
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
              Accesos rápidos
            </h3>
            <ul className="flex flex-col gap-1.5">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/55 transition-colors duration-200 hover:text-[#b04d15]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Contact */}
          <div>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
              Contacto
            </h3>
            <ul className="flex flex-col gap-2">
              {contactLinks.map(({ icon: Icon, label, href, value }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 text-sm text-white/55 transition-colors duration-200 hover:text-white"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-white/25 transition-colors duration-200 group-hover:text-[#b04d15]" />
                    <span>{value}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-3 flex flex-col gap-1 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/30">
            © 2026 Escalerilla Club La Dehesa. Todos los derechos reservados.
          </p>
          <a
            href="https://wa.me/56974340422"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/25 transition-colors duration-200 hover:text-white/60"
          >
            Tecnología desarrollada por JC
          </a>
        </div>
      </div>
    </footer>
  );
}

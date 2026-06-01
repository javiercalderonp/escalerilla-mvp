"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { submitOnboarding } from "@/app/onboarding/actions";
import { AvailabilityGrid } from "@/components/availability/availability-grid";
import { Button } from "@/components/ui/button";
import {
  AVAILABILITY_DAYS,
  type AvailabilitySlots,
  buildSlots,
  hasAnyAvailability,
} from "@/lib/availability";
import { formatPersonName } from "@/lib/format/name";
import { cleanPhone } from "@/lib/validation/phone";
import {
  onboardingFullSchema,
  onboardingStep1Schema,
  onboardingStep2Schema,
} from "@/lib/validation/player";
import iconMan from "../../../icon-man.png";
import iconWoman from "../../../icon-woman.png";

const phoneCountries = [
  {
    iso: "CL",
    flag: "🇨🇱",
    name: "Chile",
    code: "+56",
    placeholder: "9 1234 5678",
  },
  {
    iso: "AR",
    flag: "🇦🇷",
    name: "Argentina",
    code: "+54",
    placeholder: "9 11 2345 6789",
  },
  {
    iso: "PE",
    flag: "🇵🇪",
    name: "Perú",
    code: "+51",
    placeholder: "987 654 321",
  },
  {
    iso: "CO",
    flag: "🇨🇴",
    name: "Colombia",
    code: "+57",
    placeholder: "300 123 4567",
  },
  {
    iso: "US",
    flag: "🇺🇸",
    name: "Estados Unidos",
    code: "+1",
    placeholder: "415 555 2671",
  },
  {
    iso: "CH",
    flag: "🇨🇭",
    name: "Suiza",
    code: "+41",
    placeholder: "79 123 45 67",
  },
] as const;

type PhoneCountry = (typeof phoneCountries)[number];

const defaultPhoneCountry = phoneCountries[0];
const customPhoneCountryValue = "OTHER";

const levelOptions = [
  {
    value: "principiante",
    label: "Principiante",
    description: "Estoy empezando o juego muy poco.",
    accentClass: "text-[#3f9d2f]",
    illustration: {
      auraClass: "bg-[#eff8e9]",
      racketClass: "border-[#4d7045]",
      stringsClass: "border-[#b9d6ad]",
      handleClass: "bg-[#23272b]",
      angleClass: "-rotate-[32deg]",
      ballClass: "right-7 bottom-10",
      motion: "none",
    },
  },
  {
    value: "intermedio_bajo",
    label: "Intermedio bajo",
    description: "Mantengo peloteos y compito de forma recreativa.",
    accentClass: "text-[#f28a12]",
    illustration: {
      auraClass: "bg-[#fff5dc]",
      racketClass: "border-[#f0a21d]",
      stringsClass: "border-[#f4c870]",
      handleClass: "bg-[#20242a]",
      angleClass: "rotate-[26deg]",
      ballClass: "right-5 top-11",
      motion: "bounce",
    },
  },
  {
    value: "intermedio_alto",
    label: "Intermedio alto",
    description: "Juego seguido y sostengo ritmo de partido.",
    accentClass: "text-[#1d65c9]",
    illustration: {
      auraClass: "bg-[#eff5ff]",
      racketClass: "border-[#1b60b9]",
      stringsClass: "border-[#92b9ef]",
      handleClass: "bg-[#20242a]",
      angleClass: "rotate-[38deg]",
      ballClass: "right-7 bottom-8",
      motion: "speed",
    },
  },
  {
    value: "avanzado",
    label: "Avanzado",
    description: "Compito con regularidad y tengo buen nivel táctico.",
    accentClass: "text-[#5a2cba]",
    illustration: {
      auraClass: "bg-[#f4efff]",
      racketClass: "border-[#6136bc]",
      stringsClass: "border-[#baa4ed]",
      handleClass: "bg-[#20242a]",
      angleClass: "rotate-[36deg]",
      ballClass: "right-7 bottom-9",
      motion: "speed",
    },
  },
] as const;

type WizardValues = {
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  birthDate: string;
  phone: string;
  rut: string;
  level: "principiante" | "intermedio_bajo" | "intermedio_alto" | "avanzado";
  dominantHand: "diestro" | "zurdo";
  backhand: "una_mano" | "dos_manos";
  availMonday: boolean;
  availTuesday: boolean;
  availWednesday: boolean;
  availThursday: boolean;
  availFriday: boolean;
  availSaturday: boolean;
  availSunday: boolean;
  availabilitySlots: AvailabilitySlots;
};

const initialValues: WizardValues = {
  firstName: "",
  lastName: "",
  gender: "M",
  birthDate: "",
  phone: "",
  rut: "",
  level: "intermedio_bajo",
  dominantHand: "diestro",
  backhand: "dos_manos",
  availMonday: false,
  availTuesday: false,
  availWednesday: false,
  availThursday: false,
  availFriday: false,
  availSaturday: false,
  availSunday: false,
  availabilitySlots: AVAILABILITY_DAYS.reduce((acc, { key }) => {
    acc[key] = buildSlots(key, false);
    return acc;
  }, {} as AvailabilitySlots),
};

function getMaxBirthDate() {
  const now = new Date();
  now.setFullYear(now.getFullYear() - 14);
  return now.toISOString().slice(0, 10);
}

export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [values, setValues] = useState<WizardValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const progress = useMemo(() => {
    if (step === 1) return 33;
    if (step === 2) return 67;
    return 100;
  }, [step]);

  function updateValue<Key extends keyof WizardValues>(
    key: Key,
    value: WizardValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setServerError(null);
  }

  function updateAvailability(availabilitySlots: AvailabilitySlots) {
    setValues((current) => ({
      ...current,
      availabilitySlots,
      availMonday: availabilitySlots.availMonday.some(Boolean),
      availTuesday: availabilitySlots.availTuesday.some(Boolean),
      availWednesday: availabilitySlots.availWednesday.some(Boolean),
      availThursday: availabilitySlots.availThursday.some(Boolean),
      availFriday: availabilitySlots.availFriday.some(Boolean),
      availSaturday: availabilitySlots.availSaturday.some(Boolean),
      availSunday: availabilitySlots.availSunday.some(Boolean),
    }));
    setErrors((current) => {
      const next = { ...current };
      delete next.availDays;
      delete next.availabilitySlots;
      return next;
    });
    setServerError(null);
  }

  function applyZodErrors(
    issueList: { path: PropertyKey[]; message: string }[],
  ) {
    const nextErrors: Record<string, string> = {};
    for (const issue of issueList) {
      const key = String(issue.path[0] ?? "form");
      if (!nextErrors[key]) {
        nextErrors[key] = issue.message;
      }
    }
    setErrors(nextErrors);
  }

  function handleGoToStep2() {
    const parsed = onboardingStep1Schema.safeParse(values);
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    setStep(2);
  }

  function handleGoToStep3() {
    const parsed = onboardingStep2Schema.safeParse(values);
    if (!parsed.success) {
      applyZodErrors(parsed.error.issues);
      return;
    }
    setErrors({});
    setStep(3);
  }

  function handleSubmit() {
    if (!hasAnyAvailability(values.availabilitySlots)) {
      setErrors({ availDays: "Selecciona al menos un día disponible" });
      return;
    }

    const parsed = onboardingFullSchema.safeParse(values);

    if (!parsed.success) {
      applyZodErrors(parsed.error.issues);
      return;
    }

    setErrors({});
    setServerError(null);

    startTransition(async () => {
      try {
        const result = await submitOnboarding(values);

        if (result?.error === "rut_taken") {
          setServerError("Ese RUT ya está registrado para otro jugador.");
          return;
        }

        if (result?.error === "player_already_linked") {
          setServerError("Ese jugador ya está asociado a otra cuenta.");
          return;
        }

        if (result?.error === "unexpected") {
          setServerError(
            result.message || "No pudimos guardar tu perfil. Intenta de nuevo.",
          );
        }
      } catch (error) {
        setServerError(
          error instanceof Error
            ? error.message
            : "No pudimos guardar tu perfil. Intenta de nuevo.",
        );
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:rounded-3xl sm:p-8">
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-court">Paso {step} de 3</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-clay transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-5 space-y-4 sm:mt-8 sm:space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <Field label="Nombre" error={errors.firstName}>
              <input
                className="w-full rounded-2xl border border-border px-4 py-2.5 text-sm outline-none focus:border-court sm:py-3"
                value={values.firstName}
                onChange={(event) =>
                  updateValue("firstName", formatPersonName(event.target.value))
                }
              />
            </Field>
            <Field label="Apellido" error={errors.lastName}>
              <input
                className="w-full rounded-2xl border border-border px-4 py-2.5 text-sm outline-none focus:border-court sm:py-3"
                value={values.lastName}
                onChange={(event) =>
                  updateValue("lastName", formatPersonName(event.target.value))
                }
              />
            </Field>
          </div>

          <Field label="Categoría" error={errors.gender}>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <ToggleCard
                active={values.gender === "M"}
                ariaLabel="Hombres"
                onClick={() => updateValue("gender", "M")}
              >
                <Image
                  src={iconMan}
                  alt=""
                  aria-hidden="true"
                  className="size-10 object-contain sm:size-11"
                />
                <span className="sr-only">Hombres</span>
              </ToggleCard>
              <ToggleCard
                active={values.gender === "F"}
                ariaLabel="Mujeres"
                onClick={() => updateValue("gender", "F")}
              >
                <Image
                  src={iconWoman}
                  alt=""
                  aria-hidden="true"
                  className="size-10 object-contain sm:size-11"
                />
                <span className="sr-only">Mujeres</span>
              </ToggleCard>
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <Field label="Fecha de nacimiento" error={errors.birthDate}>
              <input
                type="date"
                max={getMaxBirthDate()}
                className="w-full rounded-2xl border border-border px-4 py-2.5 text-sm outline-none focus:border-court sm:py-3"
                value={values.birthDate}
                onChange={(event) =>
                  updateValue("birthDate", event.target.value)
                }
              />
            </Field>
            <Field label="Teléfono" error={errors.phone}>
              <PhoneInput
                value={values.phone}
                onChange={(phone) => updateValue("phone", phone)}
                invalid={Boolean(errors.phone)}
              />
            </Field>
          </div>

          <Field label="RUT" error={errors.rut}>
            <input
              className="w-full rounded-2xl border border-border px-4 py-2.5 text-sm outline-none focus:border-court sm:py-3"
              placeholder="12.345.678-5"
              value={values.rut}
              onChange={(event) => updateValue("rut", event.target.value)}
            />
          </Field>

          <div className="flex justify-end">
            <Button onClick={handleGoToStep2}>Siguiente</Button>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="mt-8 space-y-6">
          <Field label="Nivel" error={errors.level}>
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {levelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateValue("level", option.value)}
                  aria-pressed={values.level === option.value}
                  className={`min-h-[236px] rounded-[18px] border bg-white px-3 py-4 text-center shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition sm:min-h-[258px] sm:px-5 sm:py-5 ${
                    values.level === option.value
                      ? "border-court ring-2 ring-court/10"
                      : "border-[#e2e5ea] hover:border-court/40"
                  }`}
                >
                  <LevelIllustration option={option} />
                  <p
                    className={`mt-3 text-base font-bold leading-tight ${option.accentClass}`}
                  >
                    {option.label}
                  </p>
                  <p className="mx-auto mt-2 max-w-[10rem] text-sm font-medium leading-6 text-[#687181]">
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mano dominante" error={errors.dominantHand}>
              <div className="grid grid-cols-2 gap-3">
                <ToggleCard
                  active={values.dominantHand === "diestro"}
                  onClick={() => updateValue("dominantHand", "diestro")}
                >
                  Diestro
                </ToggleCard>
                <ToggleCard
                  active={values.dominantHand === "zurdo"}
                  onClick={() => updateValue("dominantHand", "zurdo")}
                >
                  Zurdo
                </ToggleCard>
              </div>
            </Field>

            <Field label="Revés" error={errors.backhand}>
              <div className="grid grid-cols-2 gap-3">
                <ToggleCard
                  active={values.backhand === "una_mano"}
                  onClick={() => updateValue("backhand", "una_mano")}
                >
                  Una mano
                </ToggleCard>
                <ToggleCard
                  active={values.backhand === "dos_manos"}
                  onClick={() => updateValue("backhand", "dos_manos")}
                >
                  Dos manos
                </ToggleCard>
              </div>
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Volver
            </Button>
            <Button onClick={handleGoToStep3}>Siguiente</Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <p className="text-sm text-muted-foreground">
            Tu rival verá estos días para coordinar el partido. Puedes
            actualizarlos cuando quieras desde tu perfil.
          </p>

          <Field
            label="¿Qué horarios normalmente puedes jugar?"
            error={errors.availDays}
          >
            <AvailabilityGrid
              availability={values.availabilitySlots}
              onChange={updateAvailability}
            />
          </Field>

          {serverError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {serverError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Volver
            </Button>
            <Button disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Guardando..." : "Guardar perfil"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function LevelIllustration({
  option,
}: {
  option: (typeof levelOptions)[number];
}) {
  const { illustration } = option;

  return (
    <div className="relative mx-auto h-28 w-28 text-current sm:h-32 sm:w-32">
      <div
        className={`absolute inset-0 rounded-full ${illustration.auraClass}`}
      />
      {illustration.motion === "speed" ? (
        <div className="absolute top-8 left-1 flex rotate-[-28deg] flex-col gap-2">
          <span className="block h-0.5 w-8 rounded-full bg-current opacity-25" />
          <span className="block h-0.5 w-12 rounded-full bg-current opacity-25" />
          <span className="block h-0.5 w-7 rounded-full bg-current opacity-25" />
        </div>
      ) : null}
      {illustration.motion === "bounce" ? (
        <div className="absolute right-7 bottom-6 h-9 w-12 border-[#45556b] border-b-2 border-dashed opacity-80 [border-radius:0_0_50%_50%]" />
      ) : null}
      <div
        className={`absolute top-9 left-8 h-20 w-9 origin-bottom ${illustration.angleClass}`}
      >
        <span
          className={`absolute top-0 left-0 h-14 w-9 rounded-[999px] border-[3px] bg-white/45 ${illustration.racketClass}`}
        >
          <span
            className={`absolute inset-1 rounded-[999px] border bg-[linear-gradient(90deg,transparent_45%,currentColor_46%,currentColor_54%,transparent_55%),linear-gradient(0deg,transparent_45%,currentColor_46%,currentColor_54%,transparent_55%)] bg-[length:9px_9px] opacity-45 ${illustration.stringsClass}`}
          />
        </span>
        <span
          className={`absolute top-[49px] left-[13px] h-12 w-3 rounded-full ${illustration.handleClass}`}
        />
      </div>
      <span
        className={`absolute ${illustration.ballClass} flex size-7 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_25%,#e9ff67_0_16%,#b9dd20_46%,#72a911_100%)] shadow-sm`}
        aria-hidden="true"
      >
        <span className="h-6 w-3 rounded-full border-white/80 border-l-2" />
      </span>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block space-y-1.5 text-sm sm:space-y-2">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  );
}

function PhoneInput({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [countryCode, setCountryCode] = useState<string>(
    defaultPhoneCountry.code,
  );
  const [customCountryCode, setCustomCountryCode] = useState("+");
  const selectedCountry =
    countryCode === customPhoneCountryValue
      ? null
      : ((value
          ? getPhoneCountry(value)
          : getPhoneCountryByCode(countryCode)) ?? defaultPhoneCountry);
  const activeCountryCode =
    selectedCountry?.code ?? normalizeCustomCountryCode(customCountryCode);
  const localNumber = getLocalPhoneNumber(
    value,
    activeCountryCode,
    selectedCountry?.iso,
  );

  function handleCountryChange(countryCode: string) {
    if (countryCode === customPhoneCountryValue) {
      const digits = cleanPhone(localNumber).replace(/\D/g, "");
      const nextCountryCode = normalizeCustomCountryCode(customCountryCode);
      setCountryCode(customPhoneCountryValue);
      onChange(
        digits && nextCountryCode.length > 1
          ? `${nextCountryCode}${digits}`
          : "",
      );
      return;
    }

    const nextCountry =
      getPhoneCountryByCode(countryCode) ?? defaultPhoneCountry;
    const digits = cleanPhone(localNumber).replace(/^\+/, "");
    setCountryCode(nextCountry.code);
    onChange(digits ? `${nextCountry.code}${digits}` : "");
  }

  function handleCustomCountryCodeChange(nextValue: string) {
    const nextCountryCode = normalizeCustomCountryCode(nextValue);
    const digits = cleanPhone(localNumber).replace(/\D/g, "");
    setCustomCountryCode(nextCountryCode);
    onChange(
      digits && nextCountryCode.length > 1 ? `${nextCountryCode}${digits}` : "",
    );
  }

  function handleLocalNumberChange(nextValue: string) {
    const digits = cleanPhone(nextValue).replace(/\D/g, "");
    onChange(
      digits && activeCountryCode.length > 1
        ? `${activeCountryCode}${digits}`
        : "",
    );
  }

  return (
    <div
      className={`flex min-h-11 w-full overflow-hidden rounded-2xl border bg-background transition focus-within:border-court sm:min-h-12 ${
        invalid ? "border-rose-300" : "border-border"
      }`}
    >
      <label className="sr-only" htmlFor="phone-country">
        Código de país
      </label>
      <select
        id="phone-country"
        aria-label="Código de país"
        className="w-[5.75rem] shrink-0 border-border border-r bg-muted px-3 text-sm font-medium text-foreground outline-none"
        value={selectedCountry?.code ?? customPhoneCountryValue}
        onChange={(event) => handleCountryChange(event.target.value)}
      >
        {phoneCountries.map((country) => (
          <option key={country.iso} value={country.code}>
            {country.flag} {country.code}
          </option>
        ))}
        <option value={customPhoneCountryValue}>Otro</option>
      </select>
      {countryCode === customPhoneCountryValue ? (
        <input
          aria-label="Código de país manual"
          className="w-20 shrink-0 border-border border-r bg-muted px-3 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          inputMode="tel"
          placeholder="+41"
          value={customCountryCode}
          onChange={(event) =>
            handleCustomCountryCodeChange(event.target.value)
          }
        />
      ) : null}
      <input
        aria-label="Número de teléfono"
        className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground sm:py-3"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder={selectedCountry?.placeholder ?? "Número"}
        value={localNumber}
        onChange={(event) => handleLocalNumberChange(event.target.value)}
      />
    </div>
  );
}

function getPhoneCountry(value: string): PhoneCountry | undefined {
  const normalized = cleanPhone(value);
  return phoneCountries
    .filter((country) => normalized.startsWith(country.code))
    .sort((a, b) => b.code.length - a.code.length)[0];
}

function getPhoneCountryByCode(countryCode: string) {
  return phoneCountries.find((country) => country.code === countryCode);
}

function normalizeCustomCountryCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits ? `+${digits}` : "+";
}

function getLocalPhoneNumber(
  value: string,
  countryCode: string,
  countryIso?: PhoneCountry["iso"],
) {
  const normalized = cleanPhone(value);

  if (countryCode.length > 1 && normalized.startsWith(countryCode)) {
    return formatLocalPhoneNumber(
      normalized.slice(countryCode.length),
      countryIso,
    );
  }

  if (!normalized.startsWith("+")) {
    return formatLocalPhoneNumber(normalized, countryIso);
  }

  return "";
}

function formatLocalPhoneNumber(
  value: string,
  countryIso?: PhoneCountry["iso"],
) {
  const digits = value.replace(/\D/g, "");

  if (countryIso === "CL" && digits.length > 1) {
    return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`.trim();
  }

  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

function ToggleCard({
  active,
  ariaLabel,
  onClick,
  children,
}: {
  active: boolean;
  ariaLabel?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`flex min-h-11 items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-medium transition sm:min-h-12 sm:py-3 ${
        active
          ? "border-court bg-court text-court-foreground"
          : "border-border bg-background"
      }`}
    >
      {children}
    </button>
  );
}

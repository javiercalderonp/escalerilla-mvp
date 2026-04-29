"use client"

import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { submitOnboarding } from "@/app/onboarding/actions"
import {
  onboardingFullSchema,
  onboardingStep1Schema,
  onboardingStep2Schema,
} from "@/lib/validation/player"

const levelOptions = [
  {
    value: "principiante",
    label: "Principiante",
    description: "Estoy empezando o juego muy poco.",
  },
  {
    value: "intermedio_bajo",
    label: "Intermedio bajo",
    description: "Mantengo peloteos y compito de forma recreativa.",
  },
  {
    value: "intermedio_alto",
    label: "Intermedio alto",
    description: "Juego seguido y sostengo ritmo de partido.",
  },
  {
    value: "avanzado",
    label: "Avanzado",
    description: "Compito con regularidad y tengo buen nivel táctico.",
  },
] as const

type WizardValues = {
  firstName: string
  lastName: string
  gender: "M" | "F"
  birthDate: string
  phone: string
  rut: string
  level: "principiante" | "intermedio_bajo" | "intermedio_alto" | "avanzado"
  dominantHand: "diestro" | "zurdo"
  backhand: "una_mano" | "dos_manos"
  yearsPlaying: string
}

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
  yearsPlaying: "5",
}

function getMaxBirthDate() {
  const now = new Date()
  now.setFullYear(now.getFullYear() - 14)
  return now.toISOString().slice(0, 10)
}

export function OnboardingWizard() {
  const [step, setStep] = useState<1 | 2>(1)
  const [values, setValues] = useState<WizardValues>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const progress = useMemo(() => (step === 1 ? 50 : 100), [step])

  function updateValue<Key extends keyof WizardValues>(key: Key, value: WizardValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setServerError(null)
  }

  function applyZodErrors(issueList: { path: PropertyKey[]; message: string }[]) {
    const nextErrors: Record<string, string> = {}

    for (const issue of issueList) {
      const key = String(issue.path[0] ?? "form")
      if (!nextErrors[key]) {
        nextErrors[key] = issue.message
      }
    }

    setErrors(nextErrors)
  }

  function handleNextStep() {
    const parsed = onboardingStep1Schema.safeParse(values)

    if (!parsed.success) {
      applyZodErrors(parsed.error.issues)
      return
    }

    setErrors({})
    setStep(2)
  }

  function handleSubmit() {
    const parsed = onboardingFullSchema.safeParse({
      ...values,
      yearsPlaying: Number(values.yearsPlaying),
    })

    if (!parsed.success) {
      applyZodErrors(parsed.error.issues)
      return
    }

    setErrors({})
    setServerError(null)

    startTransition(async () => {
      const result = await submitOnboarding({
        ...values,
        yearsPlaying: Number(values.yearsPlaying),
      })

      if (result?.error === "rut_taken") {
        setServerError("Ese RUT ya está registrado para otro jugador.")
      }
    })
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-court">Paso {step} de 2</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-court transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {step === 1 ? (
        <div className="mt-8 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" error={errors.firstName}>
              <input
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-court"
                value={values.firstName}
                onChange={(event) => updateValue("firstName", event.target.value)}
              />
            </Field>
            <Field label="Apellido" error={errors.lastName}>
              <input
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-court"
                value={values.lastName}
                onChange={(event) => updateValue("lastName", event.target.value)}
              />
            </Field>
          </div>

          <Field label="Categoría" error={errors.gender}>
            <div className="grid grid-cols-2 gap-3">
              <ToggleCard active={values.gender === "M"} onClick={() => updateValue("gender", "M")}>
                Hombres
              </ToggleCard>
              <ToggleCard active={values.gender === "F"} onClick={() => updateValue("gender", "F")}>
                Mujeres
              </ToggleCard>
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de nacimiento" error={errors.birthDate}>
              <input
                type="date"
                max={getMaxBirthDate()}
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-court"
                value={values.birthDate}
                onChange={(event) => updateValue("birthDate", event.target.value)}
              />
            </Field>
            <Field label="Teléfono" error={errors.phone}>
              <input
                className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-court"
                placeholder="+56 9 1234 5678"
                value={values.phone}
                onChange={(event) => updateValue("phone", event.target.value)}
              />
            </Field>
          </div>

          <Field label="RUT" error={errors.rut}>
            <input
              className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-court"
              placeholder="12.345.678-5"
              value={values.rut}
              onChange={(event) => updateValue("rut", event.target.value)}
            />
          </Field>

          <div className="flex justify-end">
            <Button onClick={handleNextStep}>Siguiente</Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <Field label="Nivel" error={errors.level}>
            <div className="grid gap-3 sm:grid-cols-2">
              {levelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateValue("level", option.value)}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    values.level === option.value
                      ? "border-court bg-court/5"
                      : "border-border hover:border-court/40"
                  }`}
                >
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mano dominante" error={errors.dominantHand}>
              <div className="grid grid-cols-2 gap-3">
                <ToggleCard active={values.dominantHand === "diestro"} onClick={() => updateValue("dominantHand", "diestro")}>
                  Diestro
                </ToggleCard>
                <ToggleCard active={values.dominantHand === "zurdo"} onClick={() => updateValue("dominantHand", "zurdo")}>
                  Zurdo
                </ToggleCard>
              </div>
            </Field>

            <Field label="Revés" error={errors.backhand}>
              <div className="grid grid-cols-2 gap-3">
                <ToggleCard active={values.backhand === "una_mano"} onClick={() => updateValue("backhand", "una_mano")}>
                  Una mano
                </ToggleCard>
                <ToggleCard active={values.backhand === "dos_manos"} onClick={() => updateValue("backhand", "dos_manos")}>
                  Dos manos
                </ToggleCard>
              </div>
            </Field>
          </div>

          <Field label="Años jugando" error={errors.yearsPlaying}>
            <input
              type="number"
              min={0}
              max={80}
              className="w-full rounded-2xl border border-border px-4 py-3 text-sm outline-none focus:border-court"
              value={values.yearsPlaying}
              onChange={(event) => updateValue("yearsPlaying", event.target.value)}
            />
          </Field>

          {serverError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {serverError}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Volver
            </Button>
            <Button disabled={isPending} onClick={handleSubmit}>
              {isPending ? "Guardando..." : "Guardar perfil"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  )
}

function ToggleCard({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
        active ? "border-court bg-court text-court-foreground" : "border-border bg-background"
      }`}
    >
      {children}
    </button>
  )
}

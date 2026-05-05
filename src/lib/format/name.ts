const WORD_START_REGEX = /(^|[\s'-])(\p{L})/gu;

export function formatPersonName(value: string) {
  return value
    .toLocaleLowerCase("es-CL")
    .replace(WORD_START_REGEX, (_, separator: string, letter: string) => {
      return `${separator}${letter.toLocaleUpperCase("es-CL")}`;
    });
}

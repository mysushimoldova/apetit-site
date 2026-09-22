// Запись файла «целиком или никак»: сначала во временный файл рядом, потом
// переименование поверх. Переименование в пределах одной папки — одно
// действие файловой системы, поэтому половинчатого файла после него не
// бывает.
//
// Зачем: панель /dev/motion писала настройки прямо в src/config/motion.json.
// Когда две записи накладывались (панель сохраняет, тест восстанавливает),
// поверх старого содержимого ложилось новое, короче на несколько байт, и
// хвост старого оставался — битый JSON ронял сборку и четыре теста.
//
// Только для разработки (панель настроек). На сервере ничего не пишем.
import { rename, unlink, writeFile } from "node:fs/promises";

/** Имя временного файла своё у каждой записи: две одновременные записи не
 *  подерутся за один и тот же временный файл. Побеждает та, что переименует
 *  последней, — и файл в любом случае остаётся целым. */
function tempName(file: string): string {
  const tail = Math.random().toString(36).slice(2, 8);
  return `${file}.${process.pid}-${Date.now()}-${tail}.tmp`;
}

/** Паузы между попытками переименования, мс. */
const RETRY_MS = [10, 20, 40, 80];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Windows не даёт переименовать поверх файла, который прямо сейчас держит
 *  кто-то ещё (вторая такая же запись, антивирус, индексатор): ошибка
 *  EPERM/EACCES/EBUSY. Это не поломка, а «занято» — через миг проходит. */
function isBusy(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "EPERM" || code === "EACCES" || code === "EBUSY";
}

export async function writeFileAtomic(
  file: string,
  text: string,
): Promise<void> {
  const tmp = tempName(file);
  try {
    await writeFile(tmp, text, "utf8");
    for (let i = 0; ; i++) {
      try {
        await rename(tmp, file);
        return;
      } catch (error) {
        if (i >= RETRY_MS.length || !isBusy(error)) throw error;
        await wait(RETRY_MS[i]);
      }
    }
  } catch (error) {
    // Временный файл не должен оставаться мусором рядом с настройками
    await unlink(tmp).catch(() => {});
    throw error;
  }
}

export type VapidKeyPair = {
  publicKey: string;
  privateKey: string;
};

export type ResolvedVapidConfiguration = VapidKeyPair & {
  source: "env" | "database";
  automaticallyGenerated: boolean;
};

export class VapidEnvironmentManagedError extends Error {
  constructor() {
    super("VAPID-ключи заданы через переменные окружения. Измените ENV и перезапустите сервер.");
    this.name = "VapidEnvironmentManagedError";
  }
}

type VapidDependencies = {
  env: { publicKey?: string; privateKey?: string };
  readStored(): Promise<VapidKeyPair | null>;
  writeStored(keys: VapidKeyPair): Promise<void>;
  generate(): VapidKeyPair;
};

export async function resolveVapidConfiguration(
  dependencies: VapidDependencies,
  options: { forceRegenerate?: boolean } = {}
): Promise<ResolvedVapidConfiguration> {
  const envPublicKey = dependencies.env.publicKey?.trim();
  const envPrivateKey = dependencies.env.privateKey?.trim();
  if (envPublicKey && envPrivateKey) {
    if (options.forceRegenerate) throw new VapidEnvironmentManagedError();
    return {
      publicKey: envPublicKey,
      privateKey: envPrivateKey,
      source: "env",
      automaticallyGenerated: false
    };
  }

  if (!options.forceRegenerate) {
    const stored = await dependencies.readStored();
    if (stored) {
      return {
        ...stored,
        source: "database",
        automaticallyGenerated: true
      };
    }
  }

  const generated = dependencies.generate();
  await dependencies.writeStored(generated);
  return {
    ...generated,
    source: "database",
    automaticallyGenerated: true
  };
}

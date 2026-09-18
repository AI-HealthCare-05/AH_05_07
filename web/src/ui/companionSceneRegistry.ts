import { companionSpecies, type CompanionSpecies } from "./companion";
import { getCompanionAsset } from "./companionAssets.generated";
import { sceneManifest } from "./sceneManifest.generated";

type SceneManifestSelectableCharacters = typeof sceneManifest & {
  readonly s02SelectableCharacters: readonly string[];
};

export type ActiveSceneCharacter = Readonly<{
  id: string;
  species: CompanionSpecies;
  url: string;
  sha256: string;
}>;

export const activeSceneCompanionSpecies: readonly CompanionSpecies[] = companionSpecies;

const activeSceneCharacters: ReadonlyMap<CompanionSpecies, ActiveSceneCharacter> = (() => {
  const map = new Map<CompanionSpecies, ActiveSceneCharacter>();
  const selectableIds = (sceneManifest as SceneManifestSelectableCharacters).s02SelectableCharacters;

  for (const id of selectableIds) {
    const asset = sceneManifest.assets.find(entry => entry.id === id && entry.kind === "character");
    if (!asset || !("delivery" in asset) || !("companionSpecies" in asset)) {
      throw new Error(`invalid active scene character registration: ${id}`);
    }
    const species = asset.companionSpecies as CompanionSpecies;
    if (!(companionSpecies as readonly string[]).includes(species)) {
      throw new Error(`scene character is not an active companion species: ${species}`);
    }
    const companion = getCompanionAsset(species, "lite");
    if (asset.delivery.url !== companion.url || asset.delivery.sha256 !== companion.sha256) {
      throw new Error(`scene registration mismatch for ${species}`);
    }
    if (map.has(species)) throw new Error(`duplicate active scene species: ${species}`);
    map.set(species, {
      id,
      species,
      url: asset.delivery.url,
      sha256: asset.delivery.sha256,
    });
  }

  for (const species of companionSpecies) {
    if (!map.has(species)) throw new Error(`missing active scene species: ${species}`);
  }
  return map;
})();

export function getActiveSceneCharacter(species: CompanionSpecies): ActiveSceneCharacter {
  const character = activeSceneCharacters.get(species);
  if (!character) throw new Error(`inactive scene companion species: ${species}`);
  return character;
}

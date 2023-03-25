import fs from "fs";
import path from "path";

import { sessionIdOption } from "~src/cli/command-option/cli.option";
import { SessionIdCommandOptions } from "~src/cli/command-option/cli.option";
import { loadoutNameOption } from "~src/cli/command-option/loadout.option";
import { LoadoutNameCommandOptions } from "~src/cli/command-option/loadout.option";
import { includeUnequippedOption } from "~src/cli/command-option/loadout.option";
import { IncludeUnequippedCommandOptions } from "~src/cli/command-option/loadout.option";
import { CommandDefinition } from "~src/cli/d2cli.types";
import { getSubclassItems } from "~src/helper/inventory-bucket.helper";
import { groupEquipmentItems } from "~src/helper/inventory-bucket.helper";
import { ArmourBucketHashes } from "~src/helper/inventory-bucket.helper";
import { LoadoutInventoryBuckets } from "~src/helper/loadout.helper";
import { serializeItem } from "~src/helper/loadout.helper";
import { serializeItemPlugs } from "~src/helper/loadout.helper";
import { promisedFn } from "~src/helper/promise.helper";
import { SUBCLASS_SOCKET_NAMES } from "~src/helper/subclass.helper";
import { getLoadoutPlugRecords } from "~src/helper/subclass.helper";
import { LoadoutPlugRecord } from "~src/helper/subclass.helper";
import { AppModule } from "~src/module/app.module";
import { CharacterSelectionService } from "~src/service/character-selection/character-selection.service";
import { InventoryService } from "~src/service/inventory/inventory.service";
import { ItemService } from "~src/service/item/item.service";
import { LogService } from "~src/service/log/log.service";
import { ManifestDefinitionService } from "~src/service/manifest-definition/manifest-definition.service";
import { PastebinService } from "~src/service/pastebin/pastebin.service";
import { PlugService } from "~src/service/plug/plug.service";
import { DestinyItemComponent } from "~type/bungie-api/destiny/entities/items.types";

type CmdOptions = SessionIdCommandOptions &
  LoadoutNameCommandOptions &
  IncludeUnequippedCommandOptions & { file: string; usePastebin: boolean };

const cmd: CommandDefinition = {
  description: "Export the currently equipped loadout",
  options: [
    sessionIdOption,
    loadoutNameOption,
    includeUnequippedOption,
    {
      flags: ["f", "file <loadout-file>"],
      description: "Path to the loadout file to write",
      defaultValue: ""
    },
    {
      flags: ["use-pastebin"],
      description: "Save the loadout to Pastebin",
      defaultValue: false
    }
  ],
  action: async (_, opts) => {
    const logger = AppModule.getDefaultInstance()
      .resolve<LogService>("LogService")
      .getLogger("cmd:loadout:export");

    const {
      session: sessionId,
      loadoutName,
      includeUnequipped,
      file,
      usePastebin
    } = opts as CmdOptions;
    logger.debug(`Session ID: ${sessionId}`);

    const manifestDefinitionService =
      AppModule.getDefaultInstance().resolve<ManifestDefinitionService>(
        "ManifestDefinitionService"
      );

    const characterSelectionService =
      AppModule.getDefaultInstance().resolve<CharacterSelectionService>(
        "CharacterSelectionService"
      );

    const inventoryService =
      AppModule.getDefaultInstance().resolve<InventoryService>("InventoryService");

    const pastebinService =
      AppModule.getDefaultInstance().resolve<PastebinService>("PastebinService");

    const plugService = AppModule.getDefaultInstance().resolve<PlugService>("PlugService");

    const itemService = AppModule.getDefaultInstance().resolve<ItemService>("ItemService");

    const [characterInfoErr, characterInfo] =
      await characterSelectionService.ensureSelectedCharacter(sessionId);
    if (characterInfoErr) {
      return logger.loggedError(`Unable to get character info: ${characterInfoErr.message}`);
    }

    const allItems: DestinyItemComponent[] = [];
    const extraItemHashes: number[] = [];

    if (includeUnequipped) {
      logger.info("Retrieving inventory items ...");
      const [inventoryItemsErr, inventoryItems] = await inventoryService.getInventoryItems(
        sessionId,
        characterInfo.membershipType,
        characterInfo.membershipId,
        characterInfo.characterId
      );
      if (inventoryItemsErr) {
        return logger.loggedError(
          `Unable to retrieve inventory items: ${inventoryItemsErr.message}`
        );
      }
      inventoryItems.forEach((item) => {
        allItems.push(item);
        extraItemHashes.push(item.itemHash);
      });
    }

    logger.info("Retrieving equipment items ...");
    const [equipmentItemsErr, equipmentItems] = await inventoryService.getEquipmentItems(
      sessionId,
      characterInfo.membershipType,
      characterInfo.membershipId,
      characterInfo.characterId
    );
    if (equipmentItemsErr) {
      return logger.loggedError(`Unable to retrieve equipment items: ${equipmentItemsErr.message}`);
    }
    equipmentItems.forEach((item) => allItems.push(item));

    const subclass = getSubclassItems(equipmentItems)[0];
    if (!subclass) {
      return logger.loggedError(`Unable to retrieve equipped subclass items`);
    }

    const [subclassPlugRecordsErr, subclassPlugRecords] = await getLoadoutPlugRecords(
      logger,
      manifestDefinitionService,
      itemService,
      plugService,
      sessionId,
      characterInfo.membershipType,
      characterInfo.membershipId,
      characterInfo.characterId,
      subclass.itemHash,
      subclass.itemInstanceId,
      SUBCLASS_SOCKET_NAMES
    );
    if (subclassPlugRecordsErr) {
      return logger.loggedError(
        `Unable to export subclass plugs: ${subclassPlugRecordsErr.message}`
      );
    }

    const equipmentsByBucket = groupEquipmentItems(allItems);
    const equipments = LoadoutInventoryBuckets.reduce(
      (acc, bucket) => [...acc, ...equipmentsByBucket[bucket]],
      [] as DestinyItemComponent[]
    );

    const equipmentsPlugRecords: Record<string, LoadoutPlugRecord[]> = {};

    for (let equipmentIndex = 0; equipmentIndex < equipments.length; equipmentIndex++) {
      const equipment = equipments[equipmentIndex];

      logger.info(`Fetching item definition for ${equipment.itemHash} ...`);
      const [equipmentDefinitionErr, equipmentDefinition] =
        await manifestDefinitionService.getItemDefinition(equipment.itemHash);
      if (equipmentDefinitionErr) {
        return logger.loggedError(
          `Unable to fetch item definition for ${equipment.itemHash}: ${equipmentDefinitionErr.message}`
        );
      }

      if (ArmourBucketHashes.includes(equipment.bucketHash)) {
        const [equipmentPlugRecordsErr, equipmentPlugRecords] = await getLoadoutPlugRecords(
          logger,
          manifestDefinitionService,
          itemService,
          plugService,
          sessionId,
          characterInfo.membershipType,
          characterInfo.membershipId,
          characterInfo.characterId,
          equipment.itemHash,
          equipment.itemInstanceId,
          ["ARMOR MODS"]
        );
        if (equipmentPlugRecordsErr) {
          return logger.loggedError(
            `Unable to export equipment plugs for ${
              equipmentDefinition?.displayProperties.name || `ITEM: ${equipment.itemHash}`
            } (${equipment.itemHash}:${equipment.itemInstanceId}): ${
              equipmentPlugRecordsErr.message
            }`
          );
        }

        equipmentsPlugRecords[`${equipment.itemHash}:${equipment.itemInstanceId}`] =
          equipmentPlugRecords;
      }
    }

    const exportLines: string[] = [];

    logger.info(`Fetching item definition for ${subclass.itemHash} ...`);
    const [subclassDefinitionErr, subclassDefinition] =
      await manifestDefinitionService.getItemDefinition(subclass.itemHash);
    if (subclassDefinitionErr) {
      return logger.loggedError(
        `Unable to fetch item definition for ${subclass.itemHash}: ${subclassDefinitionErr.message}`
      );
    }

    const exportedLoadoutName =
      loadoutName || `${subclassDefinition?.displayProperties.name || "UNKNOWN SUBCLASS"} Loadout`;

    exportLines.push(`LOADOUT // ${exportedLoadoutName}`);

    const [serializeSubclassErr, serializedSubclass] = await serializeItem(
      manifestDefinitionService,
      subclass,
      true
    );
    if (serializeSubclassErr) {
      return logger.loggedError(`Unable to serialize subclass: ${serializeSubclassErr.message}`);
    }
    exportLines.push(serializedSubclass);

    const [serializeSubclassPlugsErr, serializedSubclassPlugs] = await serializeItemPlugs(
      manifestDefinitionService,
      subclass,
      subclassPlugRecords
    );
    if (serializeSubclassPlugsErr) {
      return logger.loggedError(
        `Unable to serialize subclass plugs: ${serializeSubclassPlugsErr.message}`
      );
    }
    serializedSubclassPlugs.forEach((serialized) => {
      exportLines.push(serialized);
    });

    const orderedEquipments = [
      [equipments.filter((equipment) => !extraItemHashes.includes(equipment.itemHash)), true],
      [equipments.filter((equipment) => extraItemHashes.includes(equipment.itemHash)), false]
    ] as [DestinyItemComponent[], boolean][];
    for (let equipmentsIndex = 0; equipmentsIndex < orderedEquipments.length; equipmentsIndex++) {
      const [_equipments, equip] = orderedEquipments[equipmentsIndex];

      for (let equipmentIndex = 0; equipmentIndex < _equipments.length; equipmentIndex++) {
        const equipment = _equipments[equipmentIndex];

        const [serializeEquipmentErr, serializedEquipment] = await serializeItem(
          manifestDefinitionService,
          equipment,
          equip
        );
        if (serializeEquipmentErr) {
          return logger.loggedError(
            `Unable to serialize equipment: ${serializeEquipmentErr.message}`
          );
        }
        exportLines.push(serializedEquipment);

        const [serializeEquipmentPlugsErr, serializedEquipmentPlugs] = await serializeItemPlugs(
          manifestDefinitionService,
          equipment,
          equipmentsPlugRecords[`${equipment.itemHash}:${equipment.itemInstanceId}`] || []
        );
        if (serializeEquipmentPlugsErr) {
          return logger.loggedError(
            `Unable to serialize equipment plugs: ${serializeEquipmentPlugsErr.message}`
          );
        }
        serializedEquipmentPlugs.forEach((serialized) => {
          exportLines.push(serialized);
        });
      }
    }

    if (file) {
      const loadoutFilePath = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);

      logger.info("Writing to loadout file ...");
      const [writeErr] = await promisedFn(
        () =>
          new Promise<void>((resolve, reject) => {
            fs.writeFile(loadoutFilePath, exportLines.join("\n"), "utf8", (err) => {
              err ? reject(err) : resolve();
            });
          })
      );
      if (writeErr) {
        return logger.loggedError(`Unable to write loadout file: ${writeErr.message}`);
      }
      logger.log(`Loadout exported to: ${loadoutFilePath}`);
    } else if (usePastebin) {
      logger.info("Writing loadout to Pastebin ...");
      const [pastebinUrlErr, pastebinUrl] = await pastebinService.createPaste(
        exportedLoadoutName,
        exportLines.join("\n")
      );
      if (pastebinUrlErr) {
        return logger.loggedError(`Unable to write to Pastebin: ${pastebinUrlErr.message}`);
      }

      logger.log(`Loadout URL (Pastebin): ${pastebinUrl}`);
    } else {
      logger.log(exportLines.join("\n"));
    }
  }
};

export default cmd;

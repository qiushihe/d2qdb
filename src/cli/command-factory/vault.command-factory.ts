import { sessionIdOption } from "~src/cli/command-option/cli.option";
import { SessionIdCommandOptions } from "~src/cli/command-option/cli.option";
import { verboseOption } from "~src/cli/command-option/cli.option";
import { VerboseCommandOptions } from "~src/cli/command-option/cli.option";
import { itemInstanceIdsOption } from "~src/cli/command-option/item.option";
import { ItemInstanceIdsCommandOptions } from "~src/cli/command-option/item.option";
import { CommandDefinition } from "~src/cli/d2cli.types";
import { getSelectedCharacterInfo } from "~src/helper/current-character.helper";
import { stringifyTable } from "~src/helper/table.helper";
import { AppModule } from "~src/module/app.module";
import { Destiny2InventoryService } from "~src/service/destiny2-inventory/destiny2-inventory.service";
import { Destiny2InventoryTransferService } from "~src/service/destiny2-inventory-transfer/destiny2-inventory-transfer.service";
import { ItemDefinitionService } from "~src/service/item-definition/item-definition.service";
import { LogService } from "~src/service/log/log.service";
import { DestinyItemComponent } from "~type/bungie-api/destiny/entities/items.types";

type CmdOptions = SessionIdCommandOptions & VerboseCommandOptions & ItemInstanceIdsCommandOptions;

type TransferCommandOptions = {
  toVault: boolean;
};

export const transferCommand = (options: TransferCommandOptions): CommandDefinition => {
  return {
    description: options.toVault ? "Move items into the vault" : "Take items out of the vault",
    options: [sessionIdOption, verboseOption, itemInstanceIdsOption],
    action: async (_, opts) => {
      const logger = AppModule.getDefaultInstance()
        .resolve<LogService>("LogService")
        .getLogger(options.toVault ? "cmd:vault:deposit" : "cmd:vault:withdraw");

      const {
        session: sessionId,
        verbose,
        itemInstanceIds: itemInstanceIdsStr
      } = opts as CmdOptions;
      logger.debug(`Session ID: ${sessionId}`);

      const itemDefinitionService =
        AppModule.getDefaultInstance().resolve<ItemDefinitionService>("ItemDefinitionService");

      const destiny2InventoryService =
        AppModule.getDefaultInstance().resolve<Destiny2InventoryService>(
          "Destiny2InventoryService"
        );

      const destiny2InventoryTransferService =
        AppModule.getDefaultInstance().resolve<Destiny2InventoryTransferService>(
          "Destiny2InventoryTransferService"
        );

      const [characterInfoErr, characterInfo] = await getSelectedCharacterInfo(logger, sessionId);
      if (characterInfoErr) {
        return logger.loggedError(`Unable to get character info: ${characterInfoErr.message}`);
      }

      const itemInstanceIds = (itemInstanceIdsStr || "").trim().split(",");

      if (itemInstanceIds.length > 0) {
        let sourceItems: DestinyItemComponent[];

        if (options.toVault) {
          const [inventoryItemsErr, inventoryItems] =
            await destiny2InventoryService.getInventoryItems(
              sessionId,
              characterInfo.membershipType,
              characterInfo.membershipId,
              characterInfo.characterId
            );
          if (inventoryItemsErr) {
            return logger.loggedError(
              `Unable to get inventory items: ${inventoryItemsErr.message}`
            );
          }
          sourceItems = inventoryItems;
        } else {
          const [vaultItemsErr, vaultItems] = await destiny2InventoryService.getVaultItems(
            sessionId,
            characterInfo.membershipType,
            characterInfo.membershipId
          );
          if (vaultItemsErr) {
            return logger.loggedError(`Unable to get vault items: ${vaultItemsErr.message}`);
          }
          sourceItems = vaultItems;
        }

        const tableData: string[][] = [];

        const basicHeaders = ["Item", "Transferred?"];
        if (verbose) {
          tableData.push([...basicHeaders, "Message"]);
        } else {
          tableData.push(basicHeaders);
        }

        let failedToTransferCount = 0;
        for (
          let itemInstanceIdIndex = 0;
          itemInstanceIdIndex < itemInstanceIds.length;
          itemInstanceIdIndex++
        ) {
          const itemInstanceId = itemInstanceIds[itemInstanceIdIndex];
          const item = sourceItems.find((item) => item.itemInstanceId === itemInstanceId) || null;

          if (item) {
            logger.info(`Fetching item definition for ${item.itemHash} ...`);
            const [itemDefinitionErr, itemDefinition] =
              await itemDefinitionService.getItemDefinition(item.itemHash);
            if (itemDefinitionErr) {
              return logger.loggedError(`Unable to fetch item definition for ${item.itemHash}`);
            }

            let itemDescription: string;
            if (!itemDefinition) {
              itemDescription = `Missing item definition for hash ${item.itemHash}`;
            } else {
              itemDescription = `${itemDefinition.displayProperties.name} (${itemDefinition.itemTypeAndTierDisplayName})`;
            }

            const itemCells = [itemDescription];

            logger.info(
              itemInstanceIds.length <= 1
                ? `Transferring item ${
                    options.toVault ? "to" : "from"
                  } vault: ${itemDescription} ...`
                : `Transferring item ${itemInstanceIdIndex + 1} of ${itemInstanceIds.length} ${
                    options.toVault ? "to" : "from"
                  } vault: ${itemDescription} ...`
            );
            const transferFromVaultErr = await (options.toVault
              ? destiny2InventoryTransferService.transferToVault(
                  sessionId,
                  characterInfo.membershipType,
                  characterInfo.characterId,
                  item.itemHash,
                  item.itemInstanceId
                )
              : destiny2InventoryTransferService.transferFromVault(
                  sessionId,
                  characterInfo.membershipType,
                  characterInfo.characterId,
                  item.itemHash,
                  item.itemInstanceId
                ));
            if (transferFromVaultErr) {
              failedToTransferCount = failedToTransferCount + 1;
              if (verbose) {
                tableData.push([...itemCells, "No", transferFromVaultErr.message]);
              } else {
                tableData.push([...itemCells, "No"]);
              }
            } else {
              if (verbose) {
                tableData.push([...itemCells, "Yes", ""]);
              } else {
                tableData.push([...itemCells, "Yes"]);
              }
            }
          } else {
            failedToTransferCount = failedToTransferCount + 1;
            if (verbose) {
              tableData.push([
                itemInstanceId,
                "No",
                `Unable to find item in ${options.toVault ? "inventory" : "vault"}`
              ]);
            } else {
              tableData.push([itemInstanceId, "No"]);
            }
          }
        }

        logger.log(stringifyTable(tableData));

        if (failedToTransferCount > 0) {
          logger.log(`Failed to transfer ${failedToTransferCount} item(s)`);
          if (!verbose) {
            logger.log(
              `Re-run this command with the "--verbose" (or "-v") option to view the error message(s)`
            );
          }
        }
      } else {
        logger.log("No item instance ID(s) specified!");
      }
    }
  };
};

import { InventoryBucket } from "~src/helper/inventory-bucket.helper";
import { LoadoutPlugRecord } from "~src/helper/subclass.helper";
import { ItemDefinitionService } from "~src/service/item-definition/item-definition.service";
import { DestinyItemComponent } from "~type/bungie-api/destiny/entities/items.types";

export const LoadoutInventoryBuckets = [
  InventoryBucket.KineticWeapon,
  InventoryBucket.EnergyWeapon,
  InventoryBucket.PowerWeapon,
  InventoryBucket.Helmet,
  InventoryBucket.Gauntlet,
  InventoryBucket.ChestArmour,
  InventoryBucket.LegArmour,
  InventoryBucket.ClassItem
];

export const serializeItem = async (
  itemDefinitionService: ItemDefinitionService,
  item: DestinyItemComponent,
  equip: boolean
): Promise<[Error, null] | [null, string]> => {
  const [itemDefinitionErr, itemDefinition] = await itemDefinitionService.getItemDefinition(
    item.itemHash
  );
  if (itemDefinitionErr) {
    return [itemDefinitionErr, null];
  }

  const itemName = itemDefinition?.displayProperties.name || "UNKNOWN ITEM";
  const itemInfo = [`${item.itemHash}:${item.itemInstanceId}`].join("::");

  return [null, `${equip ? "EQUIP" : "EXTRA"} // ${itemInfo} // ${itemName}`];
};

export const serializeItemPlugs = async (
  itemDefinitionService: ItemDefinitionService,
  item: DestinyItemComponent,
  plugs: LoadoutPlugRecord[]
): Promise<[Error, null] | [null, string[]]> => {
  const serializedPlugs: string[] = [];

  for (let plugIndex = 0; plugIndex < plugs.length; plugIndex++) {
    const plug = plugs[plugIndex];

    const [plugItemDefinitionErr, plugItemDefinition] =
      await itemDefinitionService.getItemDefinition(plug.itemHash);
    if (plugItemDefinitionErr) {
      return [plugItemDefinitionErr, null];
    }

    const plugName = plugItemDefinition?.displayProperties.name || "UNKNOWN ITEM";
    const plugInfo = [
      `${item.itemHash}:${item.itemInstanceId}`,
      `index:${plug.socketIndex}`,
      `plug:${plug.itemHash}`
    ].join("::");

    serializedPlugs.push(`SOCKET // ${plugInfo} // ${plugName}`);
  }

  return [null, serializedPlugs];
};

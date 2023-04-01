import { Logger } from "~src/service/log/log.types";
import { PlugService } from "~src/service/plug/plug.service";
import { SocketName } from "~src/service/plug/plug.service.types";
import { DestinyInventoryItemDefinition } from "~type/bungie-api/destiny/definitions.types";
import { DestinyItemSocketsComponent } from "~type/bungie-api/destiny/entities/items.types";

export const SUBCLASS_SOCKET_NAMES = ["ABILITIES", "SUPER", "ASPECTS", "FRAGMENTS"];

export type LoadoutPlugRecord = {
  itemHash: number;
  socketIndex: number;
};

export const getLoadoutPlugRecords = async (
  logger: Logger,
  itemDefinitions: Record<number, DestinyInventoryItemDefinition>,
  itemsSockets: Record<string, DestinyItemSocketsComponent>,
  plugService: PlugService,
  sessionId: string,
  membershipType: number,
  membershipId: string,
  characterId: string,
  itemHash: number,
  itemInstanceId: string,
  socketNames: string[]
): Promise<[Error, null] | [null, LoadoutPlugRecord[]]> => {
  const itemDefinition = itemDefinitions[itemHash];
  const itemName = itemDefinition?.displayProperties.name || "UNKNOWN ITEM";

  const equippedPlugHashes = itemsSockets[itemInstanceId].sockets.map(
    (socket) => socket.plugHash || -1
  );

  const plugRecords: LoadoutPlugRecord[] = [];

  for (let socketNameIndex = 0; socketNameIndex < socketNames.length; socketNameIndex++) {
    const socketName = socketNames[socketNameIndex] as SocketName;

    logger.info(`Fetching ${itemName} ${socketName.toLocaleLowerCase()} socket indices ...`);
    const [socketIndicesErr, socketIndices] = await plugService.getSocketIndices(
      sessionId,
      membershipType,
      membershipId,
      characterId,
      itemHash,
      socketName
    );
    if (socketIndicesErr) {
      return [
        logger.loggedError(
          `Unable to fetch ${socketName.toLocaleLowerCase()} socket indices for ${itemName}: ${
            socketIndicesErr.message
          }`
        ),
        null
      ];
    }

    for (let index = 0; index < socketIndices.length; index++) {
      const socketIndex = socketIndices[index];
      const equippedPlugItemHash = equippedPlugHashes[socketIndex] || -1;

      plugRecords.push({ socketIndex, itemHash: equippedPlugItemHash });
    }
  }

  return [null, plugRecords];
};

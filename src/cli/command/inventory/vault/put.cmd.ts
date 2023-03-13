import { CommandDefinition } from "~src/cli/d2cli.types";

import { transferCommand } from "./transferrer";

const cmd: CommandDefinition = transferCommand({ toVault: true });

export default cmd;

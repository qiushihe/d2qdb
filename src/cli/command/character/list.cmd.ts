import { format } from "date-fns";

import { CommandDefinition } from "~src/cli/d2qdb.types";
import { TextGrid } from "~src/helper/text-grid";
import { AppModule } from "~src/module/app.module";
import { Destiny2CharacterService } from "~src/service/destiny2-character/destiny2-character.service";
import { LogService } from "~src/service/log/log.service";

import { sessionIdOption } from "../../command-option/session-id.option";
import { verboseOption } from "../../command-option/verbose.option";
import { SessionCommandOptions } from "../command.types";

type CmdOptions = SessionCommandOptions & { verbose: boolean };

const cmd: CommandDefinition = {
  description: "List Destiny 2 characters",
  options: [sessionIdOption, verboseOption],
  action: async (_, opts) => {
    const logger = AppModule.getDefaultInstance()
      .resolve<LogService>("LogService")
      .getLogger("cmd:character:list");

    const { session: sessionId, verbose } = opts as CmdOptions;
    logger.debug(`Session ID: ${sessionId}`);

    const destiny2CharacterService =
      AppModule.getDefaultInstance().resolve<Destiny2CharacterService>("Destiny2CharacterService");

    const [charactersErr, characters] = await destiny2CharacterService.getDestiny2Characters(
      sessionId
    );
    if (charactersErr) {
      logger.error(`Unable to list characters: ${charactersErr.message}`);
    } else {
      const grid = new TextGrid();

      const basicHeaders = ["#", "Description", "Light Level"];
      if (verbose) {
        grid.addRow([...basicHeaders, "Last Played", "ID", "Membership Type:ID"]);
      } else {
        grid.addRow(basicHeaders);
      }

      characters.forEach((character, index) => {
        const basicCells = [
          `${index + 1}`,
          `${character.class} (${character.gender} ${character.race})`,
          `${character.lightLevel}`
        ];

        if (verbose) {
          grid.addRow([
            ...basicCells,
            format(character.lastPlayedAt, "hh:mmaaa MMM. do yyyy"),
            character.id,
            `${character.membershipType}:${character.membershipId}`
          ]);
        } else {
          grid.addRow(basicCells);
        }
      });

      logger.log(grid.toString());
    }
  }
};

export default cmd;

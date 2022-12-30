import minimist from "minimist";
import opener from "opener";
import path from "path";
import * as ProtocolRegistry from "protocol-registry";

import { base42EncodeString } from "~src/helper/string.helper";
import { AppModule } from "~src/module/app.module";
import { BungieOAuthState } from "~src/service/bungie-oauth/bungie-oauth.types";
import { ConfigService } from "~src/service/config/config.service";
import { LogService } from "~src/service/log/log.service";

import { CliCmdDefinition } from "../cli.types";

type LoginCmdArgv = {
  noOpen: boolean;
};

export const login: CliCmdDefinition = {
  description: "Login with Bungie.net",
  action: async (server, context, arg) => {
    const { noOpen } = minimist<LoginCmdArgv>((arg || "").split(" "), {
      string: [],
      boolean: ["noOpen"],
      default: { noOpen: false },
      alias: { noOpen: ["no-open", "no"] }
    });

    const logger = AppModule.getDefaultInstance()
      .resolve<LogService>("LogService")
      .getLogger("cmd:login");

    const config = AppModule.getDefaultInstance().resolve<ConfigService>("ConfigService");

    const oauthRoot = config.getBungieOauthRoot();
    const clientId = config.getBungieOauthClientId();
    const state: BungieOAuthState = { t: new Date().getTime(), s: context.sessionId };
    const encodedState = base42EncodeString(JSON.stringify(state));
    logger.info("Done state encoding");

    const oauthUrl = new URL(oauthRoot);
    oauthUrl.searchParams.set("client_id", clientId);
    oauthUrl.searchParams.set("response_type", "code");
    oauthUrl.searchParams.set("state", encodedState);
    logger.info("Done URL construction");

    const tsNodeCmd = path.join(context.repoRootPath, "node_modules/.bin/ts-node");
    const handlerPath = path.join(context.repoRootPath, "src/cli/oauth-return-raw.ts");

    await ProtocolRegistry.register({
      protocol: "dtwoqdb",
      command: `${tsNodeCmd} ${handlerPath} ${context.repoRootPath} $_URL_`,
      override: true,
      terminal: true,
      script: true
    });
    logger.info("Done protocol registration");

    const oauthUrlString = oauthUrl.toString();

    if (noOpen) {
      logger.log(`Bungie.net login URL: ${oauthUrlString}`);
    } else {
      logger.info(`Bungie.net login URL: ${oauthUrlString}`);
      opener(oauthUrlString);
    }
  }
};

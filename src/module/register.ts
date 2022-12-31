import { BungieApiService } from "~src/service/bungie-api/bungie.api.service";
import { BungieOauthService } from "~src/service/bungie-oauth/bungie-oauth.service";
import { CacheService } from "~src/service/cache/cache.service";
import { ConfigService } from "~src/service/config/config.service";
import { Destiny2CharacterService } from "~src/service/destiny2-character/destiny2-character.service";
import { Destiny2ManifestService } from "~src/service/destiny2-manifest/destiny2-manifest.service";
import { Destiny2MembershipService } from "~src/service/destiny2-membership/destiny2-membership.service";
import { FarmingReminderService } from "~src/service/farming-reminder/farming-reminder.service";
import { LogService } from "~src/service/log/log.service";
import { SessionService } from "~src/service/session/session.service";
import { FsStorageService } from "~src/service/storage/fs-storage.service";

import { AppModule } from "./app.module";

const MODULE: Record<string, new () => any> = {
  BungieApiService,
  BungieOauthService,
  CacheService,
  ConfigService,
  Destiny2CharacterService,
  Destiny2ManifestService,
  Destiny2MembershipService,
  FarmingReminderService,
  LogService,
  SessionService,
  FsStorageService
};

const appModule = AppModule.getDefaultInstance();

Object.entries(MODULE).forEach(([name, ModuleClass]) => {
  appModule.register(name, ModuleClass);
});

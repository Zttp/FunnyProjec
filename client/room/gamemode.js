import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Players, Teams, Damage, Spawns, Timers, Chat, Bots, Inventory } from 'pixel_combats/room';

// Сопоставление игроков и ботов
const playerBotMap = new Map();  // playerId -> bot
const botPlayerMap = new Map();  // botId -> playerId

// Инициализация сервиса ботов
Bots.PoolSize = 20; // Максимальное количество ботов

// Создание единственной команды
Teams.Add('Players', '<b>Players</b>', new Color(0.5, 0.5, 0.5, 1));
const PlayersTeam = Teams.Get('Players');

// Настройка лидерборда
LeaderBoard.PlayerLeaderBoardValues = [
    new DisplayValueHeader('Kills', '<b>Kills</b>', '<b>Kills</b>'),
    new DisplayValueHeader('Deaths', '<b>Deaths</b>', '<b>Deaths</b>')
];
LeaderBoard.PlayersWeightGetter.Set(p => p.Properties.Kills.Value);

// Обработчик подключения игроков
Players.OnPlayerConnected.Add(player => {
    PlayersTeam.Add(player);
    player.PopUp('Добро пожаловать! Команды: /bot(skinId,weaponId) /aye[id]');
    player.Properties.Add('BotId', 0); // Для хранения ID бота
});

// Обработчик спавна игрока
Spawns.GetContext().OnSpawn.Add(player => {
    player.Properties.Immortality.Value = true;
    player.Timers.Get('immortality').Restart(3);
});

// Смерть игрока
Damage.OnDeath.Add(player => {
    Spawns.GetContext(player).Spawn();
    player.Properties.Deaths.Value++;
});

// Уничтожение ботов при отключении игрока
Players.OnPlayerDisconnected.Add(player => {
    const botId = player.Properties.Get('BotId').Value;
    if (botId > 0) {
        const bot = Bots.Get(botId);
        if (bot) bot.Destroy();
        playerBotMap.delete(player.id);
        botPlayerMap.delete(botId);
    }
});


// Удаление ботов
Bots.OnBotRemove.Add(bot => {
    const playerId = botPlayerMap.get(bot.Id);
    if (playerId) {
        Players.GetById(playerId)?.Properties.Get('BotId').Value = 0;
        botPlayerMap.delete(bot.Id);
        playerBotMap.delete(playerId);
    }
});

// Таймер обновления позиций ботов
const botUpdateTimer = Timers.GetContext().Get('BotUpdater');
botUpdateTimer.OnTimer.Add(() => {
    for (const [playerId, bot] of playerBotMap) {
        const player = Players.GetById(playerId);
        if (!player || !bot.Alive) continue;
        
        // Обновляем позицию и поворот бота
        const pos = player.Position.Value;
        const rot = player.Rotation.Value;
        
        bot.SetPositionAndDirection(
            new Vector3(pos.x, pos.y, pos.z),
            new Vector3(rot.x, rot.y, rot.z)
        );
    }
});
botUpdateTimer.RestartLoop(0.05); // 20 раз в секунду


// Базовая настройка инвентаря
const Inv = Inventory.GetContext();
Inv.Secondary.Value = true;
Inv.SecondaryInfinity.Value = true;
Inv.Melee.Value = true;

// Настройка урона
Damage.GetContext().DamageOut.Value = true;

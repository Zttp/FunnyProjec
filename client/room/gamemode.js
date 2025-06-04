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

// Таймер бессмертия при спавне
Timers.OnPlayerTimer.Add(timer => {
    if (timer.Id === 'immortality') {
        timer.Player.Properties.Immortality.Value = false;
    }
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

// Обработка смертей ботов
Bots.OnBotDeath.Add(data => {
    const playerId = botPlayerMap.get(data.Bot.Id);
    if (playerId) {
        const player = Players.GetById(playerId);
        if (player) {
            player.PopUp('Ваш бот уничтожен!');
            player.Properties.Get('BotId').Value = 0;
        }
        botPlayerMap.delete(data.Bot.Id);
        playerBotMap.delete(playerId);
    }
    
    if (data.Player) {
        data.Player.Properties.Kills.Value++;
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

// Обработчик команд чата
Chat.OnMessage.Add(message => {
    const text = message.Text.trim();
    const player = Players.GetByRoomId(message.Sender);
    
    if (!player) return;
    
    // Создание бота
    if (text.startsWith('/bot')) {
        // Проверка формата команды
        const match = text.match(/\/bot\((\d+),(\d+)\)/);
        if (!match) {
            player.PopUp('Используйте: /bot(skinId,weaponId)\nПример: /bot(1,1)');
            return;
        }
        
        const skinId = parseInt(match[1]);
        const weaponId = parseInt(match[2]);
        
        // Проверка существующего бота
        const currentBotId = player.Properties.Get('BotId').Value;
        if (currentBotId > 0) {
            player.PopUp('У вас уже есть бот! Сначала удалите текущего');
            return;
        }
        
        // Создание позиции для бота (над игроком)
        const playerPos = player.Position.Value;
        const spawnPos = new Vector3(playerPos.x, playerPos.y + 2, playerPos.z);
        
        // Создание бота
        const bot = Bots.CreateHuman({
            Position: spawnPos,
            Rotation: player.Rotation.Value,
            WeaponId: weaponId,
            SkinId: skinId
        });
        
        if (bot) {
            player.Properties.Get('BotId').Value = bot.Id;
            player.PopUp(`Бот создан! ID: ${bot.Id}\nУправление: /aye${bot.Id}`);
        } else {
            player.PopUp('Ошибка: не удалось создать бота');
        }
    }
    // Управление ботом
    else if (text.startsWith('/aye')) {
        const parts = text.split(' ');
        const currentBotId = player.Properties.Get('BotId').Value;
        
        // Отсоединение бота
        if (parts.length === 1) {
            if (currentBotId > 0) {
                const bot = Bots.Get(currentBotId);
                if (bot) {
                    playerBotMap.delete(player.id);
                    botPlayerMap.delete(bot.Id);
                }
                player.Properties.Get('BotId').Value = 0;
                player.PopUp('Бот отсоединён');
            }
            return;
        }
        
        // Присоединение бота
        const botId = parseInt(parts[1]);
        if (isNaN(botId)) {
            player.PopUp('Неверный ID бота');
            return;
        }
        
        const bot = Bots.Get(botId);
        if (!bot) {
            player.PopUp('Бот не найден');
            return;
        }
        
        // Проверка владельца
        if (player.Properties.Get('BotId').Value !== botId) {
            player.PopUp('Это не ваш бот!');
            return;
        }
        
        // Привязка бота
        playerBotMap.set(player.id, bot);
        botPlayerMap.set(bot.Id, player.id);
        player.PopUp(`Управление ботом ${botId}\nОстановка: /aye`);
    }
    // Справка
    else if (text === '/help') {
        player.PopUp('Команды ботов:\n' +
            '/bot(skinId,weaponId) - создать бота\n' +
            '/aye[botId] - управлять ботом\n' +
            '/aye - остановить управление\n\n' +
            'Примеры:\n' +
            '/bot(1,1) - создать бота\n' +
            '/aye123 - управлять ботом 123');
    }
});

// Базовая настройка инвентаря
const Inv = Inventory.GetContext();
Inv.Secondary.Value = true;
Inv.SecondaryInfinity.Value = true;
Inv.Melee.Value = true;

// Настройка урона
Damage.GetContext().DamageOut.Value = true;

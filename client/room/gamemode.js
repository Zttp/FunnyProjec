import { DisplayValueHeader, Color, Vector3 } from 'pixel_combats/basic';
import { Game, Players, Teams, Damage, Spawns, Timers, Chat, Bots } from 'pixel_combats/room';

const BOTS_POOL_SIZE = 20;
const RESPAWN_TIME = 3;

// Сопоставление игроков и ботов
const playerBotMap = new Map();  // playerId -> bot
const botPlayerMap = new Map();  // botId -> player

// Инициализация сервиса ботов
Bots.PoolSize = BOTS_POOL_SIZE;

// Создание единственной команды
Teams.Add('Players', 'Players', new Color(0.5, 0.5, 0.5, 1));
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
    player.PopUp('Добро пожаловать! Команды: /bot(skin,weapon) /aye[id]');
});

// Смерть игрока
Damage.OnDeath.Add(player => {
    Spawns.GetContext(player).Spawn();
    player.Properties.Deaths.Value++;
});

// Уничтожение ботов при отключении игрока
Players.OnPlayerDisconnected.Add(player => {
    const bot = playerBotMap.get(player.id);
    if (bot) {
        bot.Destroy();
        playerBotMap.delete(player.id);
        botPlayerMap.delete(bot.Id);
    }
});


// Таймер обновления позиций ботов
const botUpdateTimer = Timers.GetContext().Get('BotUpdater');
botUpdateTimer.OnTimer.Add(() => {
    for (const [playerId, bot] of playerBotMap) {
        const player = Players.GetById(playerId);
        if (!player || !bot.Alive) continue;
        
        bot.Position = player.contextedProperties.Position.Value;
        bot.Rotation = player.contextedProperties.Rotation.Value;
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
        const match = text.match(/\/bot\((\d+),(\d+)\)/);
        if (!match) {
            player.PopUp('Формат: /bot(skinId,weaponId)');
            return;
        }
        
        const skinId = parseInt(match[1]);
        const weaponId = parseInt(match[2]);
        const spawnPos = player.contextedProperties.Position.Value.clone();
        spawnPos.y += 2;
        
        const bot = Bots.CreateHuman({
            Position: spawnPos,
            Rotation: player.contextedProperties.Rotation.Value,
            WeaponId: weaponId,
            SkinId: skinId
        });
        
        if (bot) {
            player.PopUp(`Бот создан! ID: ${bot.Id}`);
        } else {
            player.PopUp('Ошибка создания бота');
        }
    }
    // Управление ботом
    else if (text.startsWith('/aye')) {
        const parts = text.split(' ');
        const currentBot = playerBotMap.get(player.id);
        
        // Отсоединение бота
        if (parts.length === 1) {
            if (currentBot) {
                playerBotMap.delete(player.id);
                botPlayerMap.delete(currentBot.Id);
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
        if (!bot || !bot.Alive) {
            player.PopUp('Бот не найден');
            return;
        }
        
        // Освобождение бота от предыдущего игрока
        const prevPlayerId = botPlayerMap.get(botId);
        if (prevPlayerId) {
            playerBotMap.delete(prevPlayerId);
            Players.GetById(prevPlayerId)?.PopUp('Бот отвязан');
        }
        
        // Отсоединение текущего бота игрока
        if (currentBot) {
            botPlayerMap.delete(currentBot.Id);
        }
        
        // Установка новой связи
        playerBotMap.set(player.id, bot);
        botPlayerMap.set(bot.Id, player.id);
        player.PopUp(`Управление ботом ${botId}`);
    }
    // Справка
    else if (text === '/help') {
        player.PopUp('Команды:\n/bot(skinId,weaponId) - создать бота\n/aye [id] - управлять ботом\n/aye - остановить управление');
    }
});

// Базовая настройка инвентаря
const Inv = Inventory.GetContext();
Inv.Secondary.Value = true;
Inv.SecondaryInfinity.Value = true;
Inv.Melee.Value = true;

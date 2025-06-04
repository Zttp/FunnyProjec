import { Vector3 } from 'pixel_combats/basic';
import { Players, Teams, Spawns, Chat, Bots, Timers, Damage } from 'pixel_combats/room';

// Карта связей: playerId -> bot
const playerBotMap = new Map();

// Инициализация ботов
Bots.PoolSize = 20;

// Создание единственной команды
Teams.Add('Players', 'Players', new Color(0.5, 0.5, 0.5, 1));
const PlayersTeam = Teams.Get('Players');
PlayersTeam.Spawns.SpawnPointsGroups.Add(1); // Добавляем группу точек спавна

// Обработчики игроков
Players.OnPlayerConnected.Add(player => {
    PlayersTeam.Add(player);
    player.PopUp('Добро пожаловать! Команды: /bot(skinId,weaponId) /aye /stop');
});

Players.OnPlayerDisconnected.Add(player => {
    const bot = playerBotMap.get(player.id);
    if (bot) {
        bot.Destroy();
        playerBotMap.delete(player.id);
    }
});

Spawns.GetContext().OnSpawn.Add(player => {
    player.Properties.Immortality.Value = true;
    player.Timers.Get('immortality').Restart(3);
});

Timers.OnPlayerTimer.Add(timer => {
    if (timer.Id === 'immortality') {
        timer.Player.Properties.Immortality.Value = false;
    }
});

Damage.OnDeath.Add(player => {
    Spawns.GetContext(player).Spawn();
    player.Properties.Deaths.Value++;
});

// Основной таймер для управления ботами
const updateTimer = Timers.GetContext().Get('BotUpdate');
updateTimer.OnTimer.Add(() => {
    playerBotMap.forEach((bot, playerId) => {
        const player = Players.GetById(playerId);
        if (!player || !bot.Alive) return;
        
        // Копируем позицию и поворот игрока
        const pos = player.Position.Value;
        const rot = player.Rotation.Value;
        
        bot.SetPositionAndDirection(
            new Vector3(pos.x, pos.y, pos.z),
            new Vector3(rot.x, rot.y, rot.z)
        );
    });
});
updateTimer.RestartLoop(0.05); // 20 раз в секунду

// Обработка команд чата
Chat.OnMessage.Add(message => {
    const text = message.Text.trim();
    const player = Players.GetByRoomId(message.Sender);
    if (!player) return;
    
    // Создание бота
    if (text.startsWith('/bot')) {
        const match = text.match(/\/bot\((\d+),(\d+)\)/);
        if (!match) {
            player.PopUp('Формат: /bot(skinId,weaponId)\nПример: /bot(1,1)');
            return;
        }
        
        const skinId = parseInt(match[1]);
        const weaponId = parseInt(match[2]);
        
        // Позиция над игроком
        const playerPos = player.Position.Value;
        const spawnPos = new Vector3(playerPos.x, playerPos.y + 2, playerPos.z);
        
        // Создаем бота
        const bot = Bots.CreateHuman({
            Position: spawnPos,
            Rotation: player.Rotation.Value,
            WeaponId: weaponId,
            SkinId: skinId
        });
        
        if (bot) {
            player.PopUp(`Бот создан! ID: ${bot.Id}`);
        } else {
            player.PopUp('Ошибка создания бота');
        }
    }
    // Начало управления ботом
    else if (text.startsWith('/aye')) {
        const parts = text.split(' ');
        if (parts.length < 2) {
            player.PopUp('Укажите ID бота: /aye [botId]');
            return;
        }
        
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
        
        // Удаляем предыдущего бота игрока
        const currentBot = playerBotMap.get(player.id);
        if (currentBot) {
            currentBot.Destroy();
        }
        
        // Устанавливаем нового бота
        playerBotMap.set(player.id, bot);
        player.PopUp(`Управление ботом ${botId}`);
    }
    // Остановка управления
    else if (text === '/stop') {
        const bot = playerBotMap.get(player.id);
        if (bot) {
            bot.Destroy();
            playerBotMap.delete(player.id);
            player.PopUp('Управление остановлено');
        }
    }
    // Справка
    else if (text === '/help') {
        player.PopUp('Команды:\n' +
            '/bot(skinId,weaponId) - создать бота\n' +
            '/aye [botId] - управлять ботом\n' +
            '/stop - остановить управление');
    }
});

// Базовая настройка инвентаря
Inventory.GetContext().Secondary.Value = true;
Inventory.GetContext().SecondaryInfinity.Value = true;
Inventory.GetContext().Melee.Value = true;

// Настройка урона
Damage.GetContext().DamageOut.Value = true;
Damage.GetContext().FriendlyFire.Value = true;

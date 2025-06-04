// Импорт модулей
import * as Basic from 'pixel_combats/basic';
import * as API from 'pixel_combats/room';
import { Players } from 'pixel_combats/room';
import { Game, Players, Teams, Spawns } from 'pixel_combats/room';

// Создаем команду игроков
let PlayersTeam = Teams.Create("players", { 
    name: "Игроки", 
    undername: "Bot Control",
    color: Basic.Color.Blue
});

// Настройки режима
API.BreackGraph.OnlyPlayerBlocksDmg = true;
API.Spawns.GetContext().RespawnTime.Value = 0;
API.Build.GetContext().FlyEnable.Value = true;
API.Build.GetContext().BuildModeEnable.Value = false;
PlayersTeam.Damage.DamageIn.Value = false;

// Переменные для управления ботами
const Bots = API.Bots;
let playerBots = {}; // { playerId: botId }
let controlledBots = {}; // { playerId: botId }

// Обработчик подключения игрока
API.Players.OnPlayerConnected.Add(function(p) {
    PlayersTeam.Add(p);
    p.Spawns.Spawn();
});

// Управление ботами
globalThis.bot = function(skinId = 11, weaponId = 0) {
    const player = API.GetPlayer();
    if (!player) return;
    
    // Удаляем предыдущего бота игрока
    if (playerBots[player.Id]) {
        const oldBot = Bots.Get(playerBots[player.Id]);
        if (oldBot) oldBot.Destroy();
    }
    
    // Создаем нового бота
    const spawnData = {
        Position: player.Position,
        Rotation: player.Rotation,
        WeaponId: weaponId,
        SkinId: skinId
    };
    
    const newBot = Bots.CreateHuman(spawnData);
    if (newBot) {
        playerBots[player.Id] = newBot.Id;
        player.PopUp(`Бот создан! ID: ${newBot.Id}`);
    }
};

globalThis.aye = function(botId) {
    const player = API.GetPlayer();
    if (!player) return;
    
    const bot = Bots.Get(botId);
    if (bot) {
        controlledBots[player.Id] = botId;
        player.PopUp(`Управление ботом ${botId} активировано!`);
    }
};

globalThis.uncontrol = function() {
    const player = API.GetPlayer();
    if (!player) return;
    
    if (controlledBots[player.Id]) {
        delete controlledBots[player.Id];
        player.PopUp("Управление ботом отключено!");
    }
};

// Обновление ботов в игровом цикле
function gameTick() {
    // Обновляем контролируемых ботов
    for (const [playerId, botId] of Object.entries(controlledBots)) {
        const player = Players.GetById(playerId);
        const bot = Bots.Get(botId);
        
        if (player && player.IsOnline && bot && bot.Alive) {
            bot.SetPositionAndDirection(
                player.Position,
                player.LookDirection
            );
            bot.Attack = player.Attack;
        }
    }
    
    // Обновляем обычных ботов
    for (const [playerId, botId] of Object.entries(playerBots)) {
        const player = Players.GetById(playerId);
        const bot = Bots.Get(botId);
        
        if (!bot || !bot.Alive) {
            delete playerBots[playerId];
            if (controlledBots[playerId]) delete controlledBots[playerId];
        }
    }
    
    API.Timers.Get("botControl").Restart(0.05, gameTick);
}

// Запускаем игровой цикл
gameTick();

// Обработчик чата для команд
API.Chat.OnMessage.Add(function(message) {
    if (message.Text.startsWith("/")) {
        const command = message.Text.slice(1);
        try {
            new Function(command)();
        } catch (e) {
            API.Ui.GetContext().Hint.Value = `Ошибка: ${e.message}`;
        }
    }
});

// Лидерборд
API.LeaderBoard.PlayerLeaderBoardValues = [
    {
        Value: "botId",
        DisplayName: "ID бота",
        ShortDisplayName: "Бот"
    }
];

// Обновляем информацию о боте в лидерборде
API.Players.OnPlayerConnected.Add(function(p) {
    p.Properties.Get("botId").Value = "Нет";
});

// Обработчик смерти ботов
Bots.OnBotDeath.Add(function(data) {
    for (const [playerId, botId] of Object.entries(playerBots)) {
        if (botId === data.Bot.Id) {
            const player = Players.GetById(playerId);
            if (player) {
                player.Properties.Get("botId").Value = "Убит";
                player.PopUp("Ваш бот уничтожен!");
            }
            delete playerBots[playerId];
            if (controlledBots[playerId]) delete controlledBots[playerId];
            break;
        }
    }
});

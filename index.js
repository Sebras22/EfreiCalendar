import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import ICAL from 'ical.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ICAL_URL = process.env.ICAL_URL.replace('webcal://', 'https://');

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const UWU_GIF = 'https://i.imgur.com/zlLz40v.mp4';

async function getPlanningEmbedForDate(targetDate) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`🗓️ Emploi du temps pour le ${targetDate.toLocaleDateString('fr-FR')}`)
        .setTimestamp()
        .setFooter({ text: 'MyEfrei Planning Bot' });

    let foundEvents = false;

    try {
        const response = await fetch(ICAL_URL);
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
        }
        const icalText = await response.text();

        const jcalData = ICAL.parse(icalText);
        const component = new ICAL.Component(jcalData);
        const events = component.getAllSubcomponents('vevent');

        const start = new Date(targetDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(targetDate);
        end.setHours(23, 59, 59, 999);

        const eventFields = [];

        events.forEach(event => {
            const startDate = new Date(event.getFirstProperty('dtstart').getFirstValue());
            const endDate = new Date(event.getFirstProperty('dtend').getFirstValue());
            const summary = event.getFirstProperty('summary')?.getFirstValue();
            
            const location = event.getFirstProperty('location')?.getFirstValue();
            const description = event.getFirstProperty('description')?.getFirstValue(); 

            if (startDate >= start && startDate <= end) {
                foundEvents = true;
                let fieldName = `**${summary || 'Sans titre'}**`;
                let fieldContent = `Heure: ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                if (location) fieldContent += `\nLieu: ${location}`;
                if (description) fieldContent += `\nProf: ${description.split('\\n')[0]}`; 

                eventFields.push({
                    name: fieldName,
                    value: fieldContent,
                    inline: false
                });
            }
        });

        if (!foundEvents) {
            embed.setDescription("Aucun événement prévu pour cette journée. Profitez-en !");
        } else {
            embed.addFields(eventFields);
        }

    } catch (error) {
        console.error('Erreur lors de la récupération ou du parsing de l\'emploi du temps :', error);
        embed.setDescription(`Désolé, une erreur est survenue lors de la récupération de l'emploi du temps : ${error.message}`);
        embed.setColor('#ff0000');
    }
    return embed;
}

client.once('ready', () => {
    console.log(`Bot Discord prêt ! Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.toLowerCase() === 'uwu') {
        await message.channel.send(UWU_GIF); 
        return; 
    }

    if (!message.content.startsWith('!planning')) return;

    if (message.content === '!planning today') { 
        const planningEmbed = await getPlanningEmbedForDate(new Date());
        await message.channel.send({ embeds: [planningEmbed] });
    } else if (message.content === '!planning') {
        const dates = [];
        const dateOptionsFields = [];

        for (let i = 0; i < 5; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push(date);
            dateOptionsFields.push({
                name: `${EMOJIS[i]} ${date.toLocaleDateString('fr-FR')}`,
                value: '\u200B',
                inline: false
            });
        }

        const selectionEmbed = new EmbedBuilder()
            .setColor('#f0b232')
            .setTitle('🗓️ Choisissez une date pour votre emploi du temps')
            .setDescription('Réagissez avec l\'emoji correspondant au jour désiré.\n*(Sélection valide pour 60 secondes)*')
            .addFields(dateOptionsFields)
            .setTimestamp()
            .setFooter({ text: 'Répondez avec une réaction !' });

        const msg = await message.channel.send({ embeds: [selectionEmbed] });

        for (let i = 0; i < dates.length; i++) {
            await msg.react(EMOJIS[i]);
        }

        const filter = (reaction, user) => {
            return EMOJIS.includes(reaction.emoji.name) && user.id === message.author.id;
        };

        msg.awaitReactions({ filter, max: 1, time: 60000, errors: ['time'] })
            .then(async collected => {
                const reaction = collected.first();
                const emojiIndex = EMOJIS.indexOf(reaction.emoji.name);
                const selectedDate = dates[emojiIndex];

                if (selectedDate) {
                    const planningEmbed = await getPlanningEmbedForDate(selectedDate);
                    await message.channel.send({ embeds: [planningEmbed] });
                } else {
                    await message.channel.send("Sélection de date invalide.");
                }
                msg.delete().catch(console.error);
            })
            .catch(collected => {
                msg.delete().catch(console.error);
                message.channel.send('Aucune sélection de date n\'a été faite dans le temps imparti.').catch(console.error);
            });
    }
});

client.login(DISCORD_TOKEN);
import type { Category } from '../shared/protocol.js';

const WORDS: Record<Category, string[]> = {
  Animals: ['penguin', 'giraffe', 'octopus', 'kangaroo', 'elephant', 'butterfly', 'shark', 'owl', 'snail', 'crab'],
  Food: ['pizza', 'banana', 'hamburger', 'ice cream', 'sushi', 'taco', 'pineapple', 'donut', 'popcorn', 'cupcake'],
  Nature: ['volcano', 'rainbow', 'mountain', 'waterfall', 'tornado', 'island', 'cactus', 'mushroom', 'moon', 'snowflake'],
  Landmarks: ['eiffel tower', 'pyramids', 'statue of liberty', 'great wall', 'taj mahal', 'colosseum', 'big ben', 'leaning tower of pisa', 'stonehenge', 'sydney opera house', 'golden gate bridge', 'mount fuji'],
  Countries: ['japan', 'italy', 'egypt', 'france', 'brazil', 'australia', 'canada', 'mexico', 'india', 'china', 'greece', 'netherlands'],
  Sports: ['basketball', 'bowling', 'archery', 'surfing', 'skiing', 'boxing', 'golf', 'tennis', 'soccer', 'fishing'],
  Fantasy: ['dragon', 'wizard', 'unicorn', 'mermaid', 'ghost', 'robot', 'pirate', 'vampire', 'alien', 'knight'],
  'Famous People': ['cleopatra', 'napoleon', 'einstein', 'shakespeare', 'elvis', 'columbus', 'gandhi', 'beethoven', 'lincoln', 'newton', 'picasso', 'houdini'],
  'League of Legends': ['teemo', 'annie', 'amumu', 'rammus', 'blitzcrank', 'nasus', 'malphite', 'ahri', 'jinx', 'thresh', 'ashe', 'lux', 'garen', 'yasuo', 'singed', 'zed',
    'veigar', 'shaco', 'draven', 'katarina', 'nami', 'fizz', 'anivia', 'warwick', 'twitch', 'braum', 'poppy', 'gragas', 'lulu', 'alistar', 'ziggs', 'illaoi'],
  Characters: ['batman', 'pikachu', 'shrek', 'yoda', 'elsa', 'spongebob', 'sonic', 'mario', 'pinocchio', 'sherlock', 'garfield', 'hulk'],
  Anime: ['naruto', 'one piece', 'dragon ball', 'pokemon', 'attack on titan', 'demon slayer', 'death note', 'jujutsu kaisen', 'my hero academia', 'spy x family', 'one punch man', 'chainsaw man', 'bleach', 'fullmetal alchemist', 'hunter x hunter'],
};

export default WORDS;

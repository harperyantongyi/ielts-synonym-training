// Curated 上下义替换 (hyponym) module seed data.
// Each group: general term (core) -> specific instances (replacements).
// Replacement meanings are real per-word Chinese glosses.
const H = (core, coreMeaning, replacements, sentence) => ({
  type: 'hyponym',
  core,
  coreMeaning,
  replacements, // array of {w, m}
  sentence,
  source: '模拟题',
  note: '',
  errorTip: '',
});

export const HYPO_GROUPS = [
  // 1. 动物分类
  H('animal', '动物', [
    { w: 'mammal', m: '哺乳动物' }, { w: 'reptile', m: '爬行动物' },
    { w: 'amphibian', m: '两栖动物' }, { w: 'bird', m: '鸟类' },
    { w: 'fish', m: '鱼类' }, { w: 'insect', m: '昆虫' },
  ], 'In biology, the general term "animal" covers many specific categories.'),
  H('mammal', '哺乳动物', [
    { w: 'whale', m: '鲸' }, { w: 'elephant', m: '大象' },
    { w: 'dog', m: '狗' }, { w: 'cat', m: '猫' },
  ], 'A "mammal" is a broader class that includes creatures like the whale.'),
  H('bird', '鸟类', [
    { w: 'eagle', m: '鹰' }, { w: 'sparrow', m: '麻雀' }, { w: 'penguin', m: '企鹅' },
  ], 'The word "bird" groups together flying and flightless species alike.'),

  // 2. 植物
  H('plant', '植物', [
    { w: 'tree', m: '树' }, { w: 'flower', m: '花' },
    { w: 'grass', m: '草' }, { w: 'shrub', m: '灌木' },
  ], 'Botanists use "plant" as the umbrella term for many living organisms.'),
  H('tree', '树', [
    { w: 'oak', m: '橡树' }, { w: 'pine', m: '松树' }, { w: 'palm', m: '棕榈' },
  ], 'An "oak" is one concrete example that falls under the term "tree".'),
  H('flower', '花', [
    { w: 'rose', m: '玫瑰' }, { w: 'tulip', m: '郁金香' }, { w: 'lily', m: '百合' },
  ], 'When the text says "flower", specific kinds like the rose are implied.'),

  // 3. 交通工具
  H('vehicle', '交通工具', [
    { w: 'car', m: '汽车' }, { w: 'bus', m: '公交车' },
    { w: 'train', m: '火车' }, { w: 'bicycle', m: '自行车' },
    { w: 'ship', m: '轮船' }, { w: 'plane', m: '飞机' },
  ], 'The general word "vehicle" can be replaced by its specific types in passages.'),
  H('car', '汽车', [
    { w: 'sedan', m: '轿车' }, { w: 'suv', m: 'SUV' }, { w: 'truck', m: '卡车' },
  ], 'A "sedan" is a particular kind of "car" mentioned in transport texts.'),

  // 4. 职业
  H('profession', '职业', [
    { w: 'doctor', m: '医生' }, { w: 'teacher', m: '教师' },
    { w: 'engineer', m: '工程师' }, { w: 'lawyer', m: '律师' }, { w: 'artist', m: '艺术家' },
  ], 'The broad term "profession" includes many specific occupations.'),
  H('scientist', '科学家', [
    { w: 'physicist', m: '物理学家' }, { w: 'chemist', m: '化学家' }, { w: 'biologist', m: '生物学家' },
  ], 'A "physicist" is a specific type of "scientist" you may read about.'),

  // 5. 学科
  H('science', '科学', [
    { w: 'physics', m: '物理学' }, { w: 'chemistry', m: '化学' },
    { w: 'biology', m: '生物学' }, { w: 'astronomy', m: '天文学' },
  ], 'The heading "science" often introduces specific fields such as physics.'),
  H('art', '艺术', [
    { w: 'painting', m: '绘画' }, { w: 'music', m: '音乐' }, { w: 'sculpture', m: '雕塑' },
  ], 'Under the general term "art" you will find concrete forms like painting.'),

  // 6. 颜色
  H('color', '颜色', [
    { w: 'red', m: '红色' }, { w: 'blue', m: '蓝色' },
    { w: 'green', m: '绿色' }, { w: 'yellow', m: '黄色' }, { w: 'white', m: '白色' },
  ], 'Descriptions use "color" as a general category for specific shades.'),
  H('red', '红色', [
    { w: 'crimson', m: '深红' }, { w: 'scarlet', m: '猩红' }, { w: 'pink', m: '粉红' },
  ], 'A "crimson" tone is one specific member of the "red" family.'),

  // 7. 自然灾害
  H('natural disaster', '自然灾害', [
    { w: 'earthquake', m: '地震' }, { w: 'flood', m: '洪水' },
    { w: 'hurricane', m: '飓风' }, { w: 'drought', m: '干旱' }, { w: 'volcano', m: '火山喷发' },
  ], 'Reports use "natural disaster" to introduce concrete events like floods.'),
  H('storm', '风暴', [
    { w: 'thunderstorm', m: '雷暴' }, { w: 'blizzard', m: '暴风雪' }, { w: 'tornado', m: '龙卷风' },
  ], 'A "tornado" is a specific kind of severe "storm".'),

  // 8. 建筑
  H('building', '建筑', [
    { w: 'house', m: '住宅' }, { w: 'school', m: '学校' },
    { w: 'hospital', m: '医院' }, { w: 'museum', m: '博物馆' }, { w: 'bridge', m: '桥' },
  ], 'Urban texts use "building" as the general word for structures.'),
  H('house', '住宅', [
    { w: 'apartment', m: '公寓' }, { w: 'villa', m: '别墅' }, { w: 'cottage', m: '小屋' },
  ], 'An "apartment" is one particular type of "house".'),

  // 9. 水果
  H('fruit', '水果', [
    { w: 'apple', m: '苹果' }, { w: 'banana', m: '香蕉' },
    { w: 'orange', m: '橙子' }, { w: 'grape', m: '葡萄' },
  ], 'The word "fruit" is often paraphrased with its concrete examples.'),
  H('berry', '浆果', [
    { w: 'strawberry', m: '草莓' }, { w: 'blueberry', m: '蓝莓' }, { w: 'raspberry', m: '树莓' },
  ], 'A "strawberry" is a specific "berry" named in food passages.'),

  // 10. 乐器
  H('instrument', '乐器', [
    { w: 'piano', m: '钢琴' }, { w: 'violin', m: '小提琴' },
    { w: 'guitar', m: '吉他' }, { w: 'flute', m: '长笛' }, { w: 'drum', m: '鼓' },
  ], 'Music articles use "instrument" as the general category.'),
  H('string instrument', '弦乐器', [
    { w: 'violin', m: '小提琴' }, { w: 'guitar', m: '吉他' }, { w: 'cello', m: '大提琴' },
  ], 'A "cello" belongs to the "string instrument" family.'),
];

// Multi-underline demo questions: one sentence, several cores underlined,
// each core tied to its own synonym/hyponym group, answered in sequence.
export const MULTI_DEMO = [
  {
    id: 'multi-1',
    type: 'multi',
    topic: '多划线综合演练',
    source: '模拟题',
    sentence: 'The animal and the plant are both living organisms studied in biology.',
    underlines: [
      {
        core: 'animal',
        coreMeaning: '动物',
        repObjs: [
          { w: 'mammal', m: '哺乳动物' }, { w: 'reptile', m: '爬行动物' },
          { w: 'bird', m: '鸟类' }, { w: 'fish', m: '鱼类' },
        ],
      },
      {
        core: 'plant',
        coreMeaning: '植物',
        repObjs: [
          { w: 'tree', m: '树' }, { w: 'flower', m: '花' }, { w: 'grass', m: '草' },
        ],
      },
    ],
  },
  {
    id: 'multi-2',
    type: 'multi',
    topic: '多划线综合演练',
    source: '模拟题',
    sentence: 'The vehicle and the building are essential parts of a modern city.',
    underlines: [
      {
        core: 'vehicle',
        coreMeaning: '交通工具',
        repObjs: [
          { w: 'car', m: '汽车' }, { w: 'bus', m: '公交车' }, { w: 'train', m: '火车' },
        ],
      },
      {
        core: 'building',
        coreMeaning: '建筑',
        repObjs: [
          { w: 'house', m: '住宅' }, { w: 'school', m: '学校' }, { w: 'hospital', m: '医院' },
        ],
      },
    ],
  },
  {
    id: 'multi-3',
    type: 'multi',
    topic: '多划线综合演练',
    source: '模拟题',
    sentence: 'Both the fruit and the color appeared in the artist’s painting.',
    underlines: [
      {
        core: 'fruit',
        coreMeaning: '水果',
        repObjs: [
          { w: 'apple', m: '苹果' }, { w: 'banana', m: '香蕉' }, { w: 'orange', m: '橙子' },
        ],
      },
      {
        core: 'color',
        coreMeaning: '颜色',
        repObjs: [
          { w: 'red', m: '红色' }, { w: 'blue', m: '蓝色' }, { w: 'green', m: '绿色' },
        ],
      },
    ],
  },
];

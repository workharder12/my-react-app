import React, { useMemo, useState } from 'react';

const initialHero = {
  name: 'TaZiMi',
  role: '战士',
  level: 40,
  hp: 5000,
  mp: 1000,
  power: 300,
  speed: 200,
  avatar:
    'https://tse4-mm.cn.bing.net/th/id/OIP-C.LLHvKWDz-Ibm3YpzqXFWzgHaEy?w=257&h=180&c=7&r=0&o=7&dpr=1.5&pid=1.7&rm=3',
  bio: '塔兹米，传说中的战士，拥有无与伦比的力量和勇气。他在战场上无所畏惧，保护着他的家园和人民。塔兹米不仅以其强大的战斗技能闻名，还以其智慧和领导才能赢得了众人的尊敬。他的故事激励着无数人追求正义与和平。',
};

function App() {
  const [hero, setHero] = useState(initialHero);
  const [favorite, setFavorite] = useState(false);

  /**
   * 计算并缓存英雄的战斗评分，依据等级、力量和速度进行加权求和。
   * 等级贡献10倍基础分，力量按2倍加权，速度按1.5倍加权后取整。
   * 仅在 hero.level、hero.power 或 hero.speed 变化时重新计算。
   */
  const battleScore = useMemo(() => {
    // 简单评分：等级影响基础，力量和速度加权
    return Math.round(hero.level * 10 + hero.power * 2 + hero.speed * 1.5);
  }, [hero.level, hero.power, hero.speed]);

  const handleTrain = () => {
    setHero((prev) => ({
      ...prev,
      level: prev.level + 1,
      hp: prev.hp + 180,
      mp: prev.mp + 60,
      power: prev.power + 15,
      speed: prev.speed + 8,
    }));
  };

  const handleReset = () => setHero(initialHero);

  return (
    <div className="card">
      <img className="avatar" src={hero.avatar} alt={hero.name} />

      <div className="header">
        <h1>{hero.name}</h1>
        <h2 className="role">
          {hero.role} · 等级 {hero.level}
        </h2>
      </div>

      <p className="bio">{hero.bio}</p>

      <div className="stats">
        <p>
          生命值 (HP): <span>{hero.hp}</span>
        </p>
        <p>
          魔法值 (MP): <span>{hero.mp}</span>
        </p>
        <p>
          力量: <span>{hero.power}</span>
        </p>
        <p>
          速度: <span>{hero.speed}</span>
        </p>
        <p>
          战力评分: <span>{battleScore}</span>
        </p>
      </div>

      <div className="action-row">
        <button className="action" onClick={handleTrain}>
          练级 +1
        </button>
        <button className="action ghost" onClick={() => setFavorite((v) => !v)}>
          {favorite ? '★ 已收藏' : '☆ 收藏' }
        </button>
        <button className="action ghost" onClick={handleReset}>
          重置
        </button>
      </div>
    </div>
  );
}

export default App;
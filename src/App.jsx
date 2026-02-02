import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const App = () => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wrappedData, setWrappedData] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const parseXML = (xmlString) => {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'text/xml');
  };

  const calculatePersonality = (games) => {
    const avgRating = games.filter(g => g.rating > 0).reduce((sum, g) => sum + g.rating, 0) / games.filter(g => g.rating > 0).length || 0;
    const wishlistCount = games.filter(g => g.wishlist).length;
    const ownedCount = games.filter(g => g.owned).length;
    const ratedCount = games.filter(g => g.rating > 0).length;
    
    const avgWeight = games.filter(g => g.weight > 0).reduce((sum, g) => sum + g.weight, 0) / games.filter(g => g.weight > 0).length || 0;
    
    if (wishlistCount > ownedCount * 0.5) {
      return {
        type: "The Dreamer",
        description: "Your wishlist tells a story of endless possibilities. You see the magic in every announcement, every Kickstarter, every 'what if.' The games you want say as much about you as the ones you own.",
        emoji: "✨"
      };
    } else if (ratedCount / ownedCount > 0.7 && avgRating > 7.5) {
      return {
        type: "The Curator",
        description: "You know what you love. Your collection isn't about quantity—it's about quality, intention, and games that earn their place on your shelf. Every rating is a deliberate choice.",
        emoji: "🎯"
      };
    } else if (avgWeight > 3.5) {
      return {
        type: "The Strategist",
        description: "You're drawn to depth, complexity, and games that reward mastery. Light fillers have their place, but you come alive when there's real weight on the table.",
        emoji: "🧠"
      };
    } else if (ownedCount > 100) {
      return {
        type: "The Collector",
        description: "Your shelf is a living library. You see potential everywhere, and every game represents a story waiting to be told. You're building something bigger than a collection—you're building a world.",
        emoji: "📚"
      };
    } else {
      return {
        type: "The Enthusiast",
        description: "You love games, pure and simple. Whether it's your tenth play of a favorite or trying something brand new, you show up for the experience, the people, and the joy of play.",
        emoji: "🎲"
      };
    }
  };

  const fetchBGGData = async (retryCount = 0) => {
    if (!username.trim()) {
      setError('Please enter a BGG username');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const collectionResponse = await fetch(
        `https://bgg-wrapped-backend.vercel.app/api/bgg-proxy?username=${encodeURIComponent(username)}`
      );
      
      if (!collectionResponse.ok) {
        throw new Error('Failed to fetch collection data. Make sure the username is correct and the collection is public.');
      }

      const collectionXML = await collectionResponse.text();
      
      // Check if BGG is still processing - auto-retry
      if (collectionXML.includes('Your request for this collection has been accepted')) {
        if (retryCount < 4) {
          // Auto-retry after 3 seconds (up to 4 times = 12 seconds total)
          setTimeout(() => {
            fetchBGGData(retryCount + 1);
          }, 3000);
          return; // Keep loading state active
        } else {
          // After 4 retries, give up
          throw new Error('BGG is taking longer than expected to process your collection. Please try again in a minute.');
        }
      }

      const collectionDoc = parseXML(collectionXML);
      
      const errorNode = collectionDoc.querySelector('error');
      if (errorNode) {
        throw new Error(errorNode.querySelector('message')?.textContent || 'Invalid username or private collection');
      }

      const items = Array.from(collectionDoc.querySelectorAll('item'));
      
      if (items.length === 0) {
        setError('No games found in collection. Make sure your collection is public and has games in it.');
        setLoading(false);
        return;
      }

      const games = items.map(item => {
        const status = item.querySelector('status');
        const stats = item.querySelector('stats');
        
        return {
          name: item.querySelector('name')?.textContent || 'Unknown',
          year: parseInt(item.querySelector('yearpublished')?.textContent) || 0,
          rating: parseFloat(item.querySelector('rating')?.textContent) || 0,
          owned: status?.getAttribute('own') === '1',
          wishlist: status?.getAttribute('wishlist') === '1',
          wishlistPriority: parseInt(status?.getAttribute('wishlistpriority')) || 0,
          numPlays: parseInt(item.querySelector('numplays')?.textContent) || 0,
          // Get weight from BGG's community rating (averageweight)
          weight: parseFloat(stats?.querySelector('averageweight')?.textContent) || 0,
          minPlayers: parseInt(stats?.querySelector('minplayers')?.textContent) || 0,
          maxPlayers: parseInt(stats?.querySelector('maxplayers')?.textContent) || 0,
          playTime: parseInt(stats?.querySelector('playingtime')?.textContent) || 0,
        };
      });

      const ownedGames = games.filter(g => g.owned);
      const ratedGames = games.filter(g => g.rating > 0).sort((a, b) => b.rating - a.rating);
      const topGames = ratedGames.slice(0, 5);
      const personality = calculatePersonality(games);
      
      const avgWeight = games.filter(g => g.weight > 0).reduce((sum, g) => sum + g.weight, 0) / games.filter(g => g.weight > 0).length || 0;
      const avgPlaytime = games.filter(g => g.playTime > 0).reduce((sum, g) => sum + g.playTime, 0) / games.filter(g => g.playTime > 0).length || 0;
      
      const comfortGame = ratedGames.find(g => g.numPlays > 3) || ratedGames[0];
      const hiddenGem = ratedGames.find(g => g.rating >= 8 && g.weight > 3.0);

      setWrappedData({
        username,
        totalGames: games.length,
        ownedGames: ownedGames.length,
        wishlistGames: games.filter(g => g.wishlist).length,
        ratedGames: ratedGames.length,
        topGames,
        personality,
        avgWeight,
        avgPlaytime,
        comfortGame,
        hiddenGem,
        year: new Date().getFullYear()
      });
      
      setCurrentSlide(0);
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
      console.error('BGG Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const slides = wrappedData ? [
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 text-white p-8">
      <div className="text-6xl mb-4">🎲</div>
      <h1 className="text-5xl font-bold mb-2 text-center">Board Game</h1>
      <h1 className="text-5xl font-bold mb-8 text-center">Wrapped {wrappedData.year}</h1>
      <p className="text-2xl opacity-90">@{wrappedData.username}</p>
    </div>,

    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-500 text-white p-8">
      <h2 className="text-4xl font-bold mb-12">Your Year at the Table</h2>
      <div className="space-y-6 w-full max-w-md">
        <div className="bg-white/20 rounded-lg p-6 backdrop-blur">
          <div className="text-5xl font-bold">{wrappedData.totalGames}</div>
          <div className="text-xl opacity-90">games in your collection</div>
        </div>
        <div className="bg-white/20 rounded-lg p-6 backdrop-blur">
          <div className="text-5xl font-bold">{wrappedData.ratedGames}</div>
          <div className="text-xl opacity-90">games rated</div>
        </div>
        <div className="bg-white/20 rounded-lg p-6 backdrop-blur">
          <div className="text-5xl font-bold">{wrappedData.wishlistGames}</div>
          <div className="text-xl opacity-90">games dreaming about</div>
        </div>
      </div>
    </div>,

    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-8">
      <div className="text-8xl mb-6">{wrappedData.personality.emoji}</div>
      <h2 className="text-5xl font-bold mb-6 text-center">{wrappedData.personality.type}</h2>
      <p className="text-xl leading-relaxed text-center max-w-lg opacity-95">
        {wrappedData.personality.description}
      </p>
    </div>,

    wrappedData.topGames.length > 0 && (
      <div className="h-full flex flex-col justify-center bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-8">
        <h2 className="text-4xl font-bold mb-8 text-center">Your Highest Rated Games</h2>
        <div className="space-y-4 max-w-lg mx-auto w-full">
          {wrappedData.topGames.slice(0, 5).map((game, i) => (
            <div key={i} className="bg-white/20 rounded-lg p-4 backdrop-blur flex items-center gap-4">
              <div className="text-3xl font-bold opacity-60">#{i + 1}</div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{game.name}</div>
                <div className="opacity-80">Rating: {game.rating.toFixed(1)}/10</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    wrappedData.comfortGame && (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-600 to-orange-600 text-white p-8">
        <h2 className="text-4xl font-bold mb-8 text-center">Your Comfort Game</h2>
        <div className="bg-white/20 rounded-2xl p-8 backdrop-blur max-w-md">
          <div className="text-6xl mb-4 text-center">🏠</div>
          <h3 className="text-3xl font-bold mb-4 text-center">{wrappedData.comfortGame.name}</h3>
          <p className="text-lg text-center opacity-90">
            {wrappedData.comfortGame.numPlays > 0 
              ? `${wrappedData.comfortGame.numPlays} plays logged. This is the one that always feels like home.`
              : 'Rated ' + wrappedData.comfortGame.rating.toFixed(1) + '/10. This is the one that always feels like home.'}
          </p>
        </div>
      </div>
    ),

    wrappedData.hiddenGem && (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white p-8">
        <h2 className="text-4xl font-bold mb-8 text-center">Your Hidden Gem</h2>
        <div className="bg-white/20 rounded-2xl p-8 backdrop-blur max-w-md">
          <div className="text-6xl mb-4 text-center">💎</div>
          <h3 className="text-3xl font-bold mb-4 text-center">{wrappedData.hiddenGem.name}</h3>
          <p className="text-lg text-center opacity-90">
            Not everyone gets this one, but you do. Rated {wrappedData.hiddenGem.rating.toFixed(1)}/10.
          </p>
        </div>
      </div>
    ),

    wrappedData.avgWeight > 0 && (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-white p-8">
        <h2 className="text-4xl font-bold mb-8 text-center">Your Complexity Profile</h2>
        <div className="w-full max-w-md">
          <div className="bg-white/10 rounded-full h-8 mb-6 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-green-400 to-red-500 h-full transition-all duration-1000"
              style={{ width: `${(wrappedData.avgWeight / 5) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-sm opacity-75 mb-8">
            <span>Light</span>
            <span>Heavy</span>
          </div>
          <div className="bg-white/20 rounded-lg p-6 backdrop-blur text-center">
            <div className="text-5xl font-bold mb-2">{wrappedData.avgWeight.toFixed(1)}</div>
            <div className="text-xl opacity-90">average complexity</div>
            <p className="mt-4 text-sm opacity-75">
              {wrappedData.avgWeight < 2 ? "You keep things accessible and fun." :
               wrappedData.avgWeight < 3 ? "You balance depth with accessibility." :
               wrappedData.avgWeight < 4 ? "You enjoy games with real strategic weight." :
               "You thrive on complexity and deep strategy."}
            </p>
          </div>
        </div>
      </div>
    ),

    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-rose-600 to-pink-600 text-white p-8">
      <div className="text-7xl mb-6">🎲</div>
      <h2 className="text-4xl font-bold mb-4 text-center">That's Your {wrappedData.year}</h2>
      <p className="text-xl text-center max-w-md opacity-90 mb-8">
        Every game, every rating, every choice tells your story as a board gamer.
      </p>
      <div className="text-sm opacity-75">
        Powered by BoardGameGeek
      </div>
    </div>
  ].filter(Boolean) : [];

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  if (!wrappedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎲</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Board Game Wrapped</h1>
            <p className="text-gray-600">Your year in board games</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter your BGG username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchBGGData(0)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-gray-800"
            />
            
            <button
              onClick={() => fetchBGGData(0)}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Analyzing your collection...' : 'Generate My Wrapped'}
            </button>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div className="text-xs text-gray-500 text-center space-y-1">
              <p>This tool uses your public BGG collection data.</p>
              <p>Try usernames like: <strong>Hipopotam</strong>, <strong>Ronfar</strong>, or <strong>whovian223</strong></p>
              <p className="mt-2 text-gray-400">Non-commercial use only. Powered by BoardGameGeek.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="relative w-full max-w-md aspect-[9/16] bg-white overflow-hidden shadow-2xl">
        {slides[currentSlide]}
        
        <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4 px-8">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="bg-white/30 backdrop-blur p-3 rounded-full disabled:opacity-30 hover:bg-white/50 transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex gap-1">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === currentSlide ? 'w-8 bg-white' : 'w-1 bg-white/40'
                }`}
              />
            ))}
          </div>
          
          <button
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="bg-white/30 backdrop-blur p-3 rounded-full disabled:opacity-30 hover:bg-white/50 transition-all"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;

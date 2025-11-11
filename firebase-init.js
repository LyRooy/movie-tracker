/**
 * Firebase Database Initialization Script
 * 
 * This script helps initialize your Firestore database with sample data.
 * Run this script once to populate your database with example movies, badges, etc.
 * 
 * Usage: node firebase-init.js
 */

const { db } = require('./firebase-admin');

// Sample movies data
const sampleMovies = [
    {
        title: 'Incepcja',
        type: 'movie',
        genre: 'Sci-Fi',
        release_date: new Date('2010-07-16'),
        description: 'Dom Cobb jest złodziejem najlepszym w swym fachu - kradnie cenne sekrety z głębin podświadomości podczas fazy snu, kiedy umysł jest najbardziej wrażliwy.',
        poster_url: 'https://via.placeholder.com/300x450/4CAF50/white?text=Incepcja',
        trailer_url: 'https://www.youtube.com/watch?v=YoHD9XEInc0'
    },
    {
        title: 'Breaking Bad',
        type: 'series',
        genre: 'Dramat',
        release_date: new Date('2008-01-20'),
        description: 'Zdiagnozowany na raka płuc nauczyciel chemii zaczyna produkować metamfetaminę, aby zapewnić swojej rodzinie finansowe bezpieczeństwo.',
        poster_url: 'https://via.placeholder.com/300x450/2196F3/white?text=Breaking+Bad',
        trailer_url: 'https://www.youtube.com/watch?v=HhesaQXLuRY'
    },
    {
        title: 'Matrix',
        type: 'movie',
        genre: 'Sci-Fi',
        release_date: new Date('1999-03-31'),
        description: 'Programista komputerowy odkrywa, że rzeczywistość w której żyje jest tylko symulacją stworzoną przez maszyny.',
        poster_url: 'https://via.placeholder.com/300x450/9C27B0/white?text=Matrix',
        trailer_url: 'https://www.youtube.com/watch?v=vKQi3bBA1y8'
    },
    {
        title: 'Stranger Things',
        type: 'series',
        genre: 'Horror',
        release_date: new Date('2016-07-15'),
        description: 'Grupa dzieci w małym miasteczku odkrywa nadprzyrodzone tajemnice i rządowe eksperymenty.',
        poster_url: 'https://via.placeholder.com/300x450/F44336/white?text=Stranger+Things',
        trailer_url: 'https://www.youtube.com/watch?v=b9EkMc79ZSU'
    },
    {
        title: 'Avengers: Endgame',
        type: 'movie',
        genre: 'Akcja',
        release_date: new Date('2019-04-26'),
        description: 'Po devastujących wydarzeniach Wojny bez granic, Avengers gromadzą się raz jeszcze, aby odwrócić działania Thanosa.',
        poster_url: 'https://via.placeholder.com/300x450/3F51B5/white?text=Endgame',
        trailer_url: 'https://www.youtube.com/watch?v=TcMBFSGVi1c'
    }
];

// Sample badges
const sampleBadges = [
    {
        name: 'Początkujący kinoman',
        description: 'Obejrzyj swój pierwszy film',
        image_url: '/images/badges/beginner.png'
    },
    {
        name: 'Miłośnik kina',
        description: 'Obejrzyj 10 filmów',
        image_url: '/images/badges/cinephile.png'
    },
    {
        name: 'Maraton serialowy',
        description: 'Obejrzyj cały sezon serialu w jeden dzień',
        image_url: '/images/badges/binge-watcher.png'
    },
    {
        name: 'Krytyk filmowy',
        description: 'Napisz 20 recenzji',
        image_url: '/images/badges/critic.png'
    },
    {
        name: 'Fan Sci-Fi',
        description: 'Obejrzyj 15 filmów sci-fi',
        image_url: '/images/badges/scifi-fan.png'
    }
];

async function initializeDatabase() {
    try {
        console.log('🚀 Starting database initialization...\n');

        // Add sample movies
        console.log('📽️  Adding sample movies...');
        const movieRefs = [];
        for (const movie of sampleMovies) {
            const movieRef = await db.collection('Movies').add({
                ...movie,
                created_at: new Date()
            });
            movieRefs.push(movieRef.id);
            console.log(`  ✓ Added: ${movie.title}`);
        }
        console.log(`✅ Added ${sampleMovies.length} movies\n`);

        // Add sample badges
        console.log('🏆 Adding sample badges...');
        const badgeRefs = [];
        for (const badge of sampleBadges) {
            const badgeRef = await db.collection('Badges').add({
                ...badge,
                created_at: new Date()
            });
            badgeRefs.push(badgeRef.id);
            console.log(`  ✓ Added: ${badge.name}`);
        }
        console.log(`✅ Added ${sampleBadges.length} badges\n`);

        // Create a sample challenge
        console.log('🎯 Creating sample challenge...');
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 days from now

        const challengeRef = await db.collection('Challenges').add({
            title: 'Wyzwanie 10 filmów',
            description: 'Obejrzyj 10 różnych filmów w ciągu 30 dni',
            type: 'watch_count',
            criteria_value: 'movie',
            target_count: 10,
            start_date: now,
            end_date: endDate,
            badge_id: badgeRefs[1], // "Miłośnik kina" badge
            created_at: now
        });
        console.log('✅ Created sample challenge\n');

        console.log('🎉 Database initialization completed successfully!\n');
        console.log('Summary:');
        console.log(`  - ${sampleMovies.length} movies added`);
        console.log(`  - ${sampleBadges.length} badges added`);
        console.log(`  - 1 challenge created`);
        console.log('\nYou can now start using the application!');

    } catch (error) {
        console.error('❌ Error initializing database:', error);
        throw error;
    }
}

// Run the initialization
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('\n✨ Done!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Failed:', error.message);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };

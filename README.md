# JUKUMU Fund - Web Portal

**"Empowering Entrepreneurs, Building a Circular Economy"**

A modern, professional web platform for JUKUMU Fund that connects entrepreneurs with community prosperity through training, networks, and economic leadership for a sustainable circular economy in Tanzania.

## 🌟 Features

### 🏠 Landing Page
- **Bilingual Support**: Primary in Kiswahili with English toggle
- **Hero Section**: Compelling introduction to JUKUMU Fund's mission
- **About Section**: Vision, Mission, Values with African-inspired design
- **How It Works**: Step-by-step explanation of the JUKUMU model
- **Impact Section**: Statistics, testimonials, and community photos
- **Registration**: Embedded form for new member signup
- **Investor Section**: Information for potential investors and partners

### 👥 Member Portal
- **Profile Management**: Complete business and personal information
- **Group Activity**: View group details, members, and contributions
- **Training Resources**: Access to business training modules with progress tracking
- **Funding Applications**: Apply for micro-investments and track status
- **Announcements**: Stay updated with group and JUKUMU news
- **Business Reports**: Track revenue, expenses, and growth metrics

### 🔧 Admin Dashboard
- **Member Management**: Approve, edit, and manage member profiles
- **Group Management**: Create and oversee entrepreneur groups
- **Investment Tracking**: Monitor equity stakes, returns, and dividends
- **Analytics & Reports**: Generate insights on growth, impact, and performance
- **System Settings**: Configure equity percentages, contribution amounts

## 🚀 Technology Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Tailwind CSS with African-inspired color palette
- **Icons**: Heroicons
- **Database**: PostgreSQL
- **Authentication**: Role-based access (Admin, Member, Treasury)
- **Deployment**: Vercel-ready

## 🎨 Design Philosophy

- **Clean & Modern**: Trust-building professional design
- **African-Inspired**: Earth tones, greens, blues color scheme
- **Mobile-First**: Responsive design for all devices
- **Accessibility**: WCAG compliant with proper contrast and navigation

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Admin dashboard
│   ├── login/            # Authentication
│   ├── portal/           # Member portal
│   └── page.tsx          # Landing page
├── components/           # Reusable UI components
├── contexts/            # React contexts (Language)
└── lib/                # Utilities and database
database/
└── schema.sql          # PostgreSQL database schema
```

## � Documentation

- **Platform overview**: `Docs/OVERVIEW.md`
- **Contributor guide**: `Docs/CONTRIBUTORS.md`
- **Admin guide**: `Docs/ADMINS.md`
- **User guide**: `Docs/USERS.md`

## �🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jukumu-web-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Update `.env.local` with your database credentials and other settings.

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb jukumu_db
   
   # Run the schema
   psql jukumu_db < database/schema.sql
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔐 Access

Set up admin and member accounts via the registration flow or by running the setup script. Do not commit credentials to this repository.

## 📊 Key Metrics & Impact

- **120+ Groups**: Active entrepreneur groups across Tanzania
- **42+ CBTs**: Community-Based Trainers
- **200+ Businesses**: Supported small enterprises
- **30% Equity Model**: Sustainable investment approach
- **15-25% ROI**: Average annual returns for investors

## 🌍 JUKUMU Model

1. **Membership & Training**: Entrepreneurs join groups, pay monthly contributions, receive training
2. **Capital Investment**: JUKUMU invests with 30% equity stake
3. **Circular Economy**: Resources circulate within the network
4. **Shared Prosperity**: Profits and dividends shared back to community

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Database Schema

The application uses a comprehensive PostgreSQL schema including:
- **Users & Members**: Authentication and profile management
- **Groups**: Entrepreneur group organization
- **Investments**: Equity tracking and returns
- **Training**: Module progress and completion
- **Reports**: Business metrics and analytics

## 🚀 Deployment

The application is configured for easy deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is proprietary to JUKUMU Fund.

## 📞 Contact

- **Email**: info@jukumufund.co.tz
- **Phone**: +255 123 456 789
- **Location**: Dar es Salaam, Tanzania

---

**JUKUMU Fund** - Building sustainable communities through entrepreneurship and circular economy principles.

# Contributing to PatientPulse

Thank you for your interest in contributing to PatientPulse! This document provides guidelines for contributing to the project.

## 🏥 Clinical Safety First

**IMPORTANT**: PatientPulse is a healthcare application prototype. Any contributions must prioritize patient safety:

- Never commit changes that could lead to incorrect clinical decision-making
- All AI-generated clinical content must include appropriate disclaimers
- Medication and treatment recommendations must be clearly marked as "for informational purposes only"
- Follow HIPAA principles even though we use synthetic data

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Patientpulse.git
   cd Patientpulse
   ```
3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 💻 Development Setup

Follow the Quick Start guide in README.md to set up your local environment.

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Code Style

**Python (Backend)**
- Follow PEP 8
- Use type hints
- Maximum line length: 100 characters
- Format with `black`
- Lint with `flake8` and `mypy`

**TypeScript (Frontend)**
- Follow Airbnb style guide
- Use functional components with hooks
- Prop types required for all components
- Format with Prettier
- Lint with ESLint

## 📝 Commit Guidelines

Use conventional commits:

```
feat: add medication interaction checker
fix: resolve CORS issue on patient endpoint
docs: update FHIR integration guide
refactor: optimize wearable data processing
test: add unit tests for recovery score calculation
```

## 🔍 Pull Request Process

1. **Update documentation** if you're changing functionality
2. **Add tests** for new features
3. **Ensure all tests pass**
4. **Update CHANGELOG.md** with your changes
5. **Request review** from maintainers

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated and passing
- [ ] No new warnings introduced
- [ ] CHANGELOG.md updated

## 🏗️ Architecture Guidelines

### Backend (FastAPI)

- **Services layer**: Business logic separate from API routes
- **Agents**: AI components isolated with clear interfaces
- **FHIR**: Always validate resources against FHIR R4 spec
- **Error handling**: Use custom exceptions with meaningful messages

### Frontend (React)

- **Component organization**: Atomic design principles
- **State management**: Zustand for global state, React Query for server state
- **API calls**: All API logic in `src/api/` directory
- **Styling**: CSS custom properties, no inline styles

## 🐛 Reporting Bugs

Create an issue with:

- **Description**: Clear, concise bug description
- **Steps to reproduce**: Numbered list
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Screenshots**: If applicable
- **Environment**: OS, Docker version, Node version, etc.

## 💡 Suggesting Features

We welcome feature suggestions! Please create an issue with:

- **Use case**: Clinical scenario this addresses
- **Proposed solution**: How it would work
- **Alternatives considered**: Other approaches you thought about
- **Clinical evidence**: Links to research supporting the feature (if applicable)

## 📚 Areas for Contribution

### High Priority

- [ ] Real wearable API integrations (Apple Health, Fitbit)
- [ ] SMART on FHIR authentication
- [ ] Comprehensive test coverage (aim for >80%)
- [ ] Accessibility improvements (WCAG 2.1 AA compliance)
- [ ] Spanish language support

### Medium Priority

- [ ] Additional AI agents (nutrition counselor, sleep coach)
- [ ] More clinical scenarios (CHF, COPD, post-surgical)
- [ ] Care team collaboration features
- [ ] Patient education content library

### Documentation

- [ ] Video walkthrough of features
- [ ] FHIR integration guide for developers
- [ ] Deployment guides (AWS, GCP, Azure)
- [ ] Clinical workflow documentation

## 🤝 Code of Conduct

### Our Standards

- **Respectful communication**: Treat all contributors with respect
- **Constructive feedback**: Focus on the code, not the person
- **Collaborative spirit**: We're building this together
- **Clinical mindfulness**: Remember that healthcare applications impact real lives

### Unacceptable Behavior

- Harassment, discrimination, or trolling
- Publishing others' private information
- Unprofessional conduct or ad hominem attacks

## 📞 Questions?

- **Technical questions**: Open a GitHub Discussion
- **Security issues**: Email pprenapurkar@hawk.iit.edu (do not create public issues)
- **General inquiries**: Comment on relevant issues or PRs

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make PatientPulse better! 🙏

# Lista de Compras - Flutter

Aplicação de lista de compras desenvolvida em Flutter para gerenciamento de itens de compra com interface intuitiva e funcionalidades completas.

## Funcionalidades

- **Adicionar Itens**: Inserção de novos itens na lista através de campo de texto
- **Marcar como Comprado**: Sistema de checkbox para controlar status dos itens
- **Remover Itens**: Exclusão individual com confirmação de segurança
- **Limpar Lista**: Remoção completa de todos os itens com confirmação
- **Estatísticas em Tempo Real**: Contadores de total, comprados e restantes
- **Prevenção de Duplicatas**: Validação automática para evitar itens repetidos
- **Feedback Visual**: Mensagens de confirmação e estados visuais diferenciados

## Tecnologias Utilizadas

- **Flutter 3.13.8**: Framework de desenvolvimento multiplataforma
- **Dart 3.1.4**: Linguagem de programação
- **Material Design 3**: Sistema de design da interface

## Estrutura da Aplicação

```
lib/
├── main.dart                # Arquivo principal da aplicação
pubspec.yaml                 # Gerenciamento de dependências
```

### Arquitetura

A aplicação utiliza o padrão StatefulWidget para gerenciamento de estado local:

- **MeuApp**: Widget raiz da aplicação (StatelessWidget)
- **PaginaInicial**: Tela principal com gerenciamento de estado (StatefulWidget)

### Widgets Principais

- `Scaffold`: Estrutura base da tela
- `AppBar`: Barra superior com título e ações
- `TextField`: Campo de entrada de texto
- `ListView.builder`: Lista dinâmica de itens
- `Card`: Cartões individuais para cada item
- `AlertDialog`: Diálogos de confirmação
- `SnackBar`: Mensagens de feedback

## Pré-requisitos

- Flutter SDK (versão 3.1.0 ou superior)
- Dart SDK
- VS Code ou Android Studio
- Git

## Instalação e Execução

1. **Clonar o repositório**:
```bash
git clone <url-do-repositorio>
cd flutter_application_1
```

2. **Instalar dependências**:
```bash
flutter pub get
```

3. **Verificar ambiente**:
```bash
flutter doctor
```

4. **Executar aplicação**:
```bash
# Desktop Linux
flutter run -d linux

# Navegador Web
flutter run -d chrome

# Dispositivos móveis (Android/iOS)
flutter run
```

## Comandos de Desenvolvimento

- `flutter analyze`: Análise estática do código
- `flutter test`: Execução de testes
- `flutter clean`: Limpeza de arquivos de build
- `r`: Hot reload durante execução
- `R`: Hot restart durante execução
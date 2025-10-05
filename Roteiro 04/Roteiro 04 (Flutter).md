## Roteiro de Aula: Instalação do Flutter no VS Code e Primeiro Projeto

O Flutter é o framework multiplataforma do Google que permite desenvolver aplicações nativas para Android, iOS, Web e Desktop usando um único código-fonte.

### Preparação do Ambiente

#### **Introdução ao Flutter**

O Flutter é uma ferramenta moderna que compila código Dart para código de máquina ARM ou Intel, garantindo alta performance em qualquer dispositivo. A principal vantagem é poder desenvolver para múltiplas plataformas mantendo uma única base de código.

#### **Pré-requisitos por Sistema Operacional**

- Visual Studio Code

### Instalação do Flutter

#### **Processo de Instalação via VS Code**

A instalação mais simplificada utiliza a extensão Flutter do VS Code. O processo inclui:

1. **Abrir paleta de comandos** (`Ctrl+Shift+P` ou `Cmd+Shift+P` ou View > Command Palette)
2. **Selecionar Flutter: New Project** após digitar "flutter"
3. **Download automático do SDK** quando solicitado pelo VS Code
4. **Configuração automática do PATH** do sistema

#### **Verificação da Instalação**

Após a instalação, execute `flutter doctor -v` no terminal integrado para verificar todas as dependências e configurações necessárias.

### Criação do Primeiro Projeto

#### **Estrutura Inicial do Projeto**

Um projeto Flutter possui estrutura organizada com pastas específicas para diferentes plataformas :

- `lib/main.dart`: arquivo principal da aplicação
- `pubspec.yaml`: gerenciamento de dependências
- Pastas platform-specific: `android/`, `ios/`, `web/`

### **Rodando o projeto sem emulador**

Utilize o comando `flutter run` para executar o projeto. Caso o Android Studio ou XCode não estejam instalados, poderá executar via Navegador

#### **Análise do Código Base**

O arquivo `main.dart` inicial demonstra conceitos fundamentais :

- Função `main()` como ponto de entrada
- `StatelessWidget` para componentes imutáveis
- `MaterialApp` para estrutura Material Design

### Personalização e Conceitos

#### **Hot Reload e Desenvolvimento**

O Flutter oferece **Hot Reload**, permitindo ver mudanças instantaneamente sem perder o estado da aplicação. Esta funcionalidade acelera significativamente o processo de desenvolvimento.

#### **Widgets Fundamentais**

Os widgets são elementos básicos de construção da interface :

- `StatelessWidget`: componentes imutáveis
- `StatefulWidget`: componentes com estado mutável
- `Column/Row`: organização de layout
- `Text`, `ElevatedButton`: elementos de interface

### Solução de Problemas Comuns

**Problemas Frequentes:**

- Flutter não reconhecido no PATH: reiniciar terminal e VS Code
- Hot reload não funcionando: verificar configuração das extensões
- Erros de compilação: executar `flutter clean` seguido de `flutter pub get`

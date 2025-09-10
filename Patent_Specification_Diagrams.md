# Patent Specification Technical Diagrams
## EOS AI Bot: Preflight Screening and Artifact System Architecture

---

## FIG. 8: Preflight Screening Process Flow

### Detailed Preflight Query Analysis and Model Selection

```mermaid
flowchart TD
    %% Start
    UserQuery[User Query Input] --> PreflightModule[Preflight Screening Module<br/>GPT-4.1-nano]
    
    %% Feature Extraction
    PreflightModule --> FeatureExtract[Query Feature Extraction<br/>50ms]
    
    FeatureExtract --> FE1[Text Length Analysis]
    FeatureExtract --> FE2[Linguistic Complexity Score]
    FeatureExtract --> FE3[Code Block Detection]
    FeatureExtract --> FE4[Mathematical Expression Check]
    FeatureExtract --> FE5[Semantic Depth Indicators]
    
    %% Context Evaluation
    FE1 & FE2 & FE3 & FE4 & FE5 --> ContextEval[Conversation Context Evaluation<br/>30ms]
    
    ContextEval --> CE1[Active Artifacts Check]
    ContextEval --> CE2[Conversation Mode<br/>Standard/Nexus]
    ContextEval --> CE3[Historical Patterns]
    ContextEval --> CE4[User Profile Type]
    
    %% Rapid Analysis
    CE1 & CE2 & CE3 & CE4 --> RapidAnalysis[Nano Model Analysis<br/>100ms]
    
    RapidAnalysis --> AnalysisFactors[Multi-Factor Decision Matrix]
    
    %% Decision Factors
    AnalysisFactors --> DF1[Query Complexity Score: 0-10]
    AnalysisFactors --> DF2[Technical Content: Boolean]
    AnalysisFactors --> DF3[Expected Response Depth: 1-5]
    AnalysisFactors --> DF4[Resource Requirements: Low/Med/High]
    
    %% Model Selection
    DF1 & DF2 & DF3 & DF4 --> ModelSelect{Model Selection<br/>Decision Engine}
    
    ModelSelect -->|Simple Query<br/>Score 0-2| GPT41[GPT-4.1 Standard]
    ModelSelect -->|Complex Query<br/>Score 3-7| GPT41Heavy[GPT-4.1 Enhanced]
    ModelSelect -->|Advanced Query<br/>Score 8-10| GPT5[GPT-5]
    ModelSelect -->|Extreme Complexity<br/>Plus Reasoning| GPT5Think[GPT-5 with Thinking]
    
    %% Token Allocation
    DF1 & DF2 & DF3 & DF4 --> TokenAlloc{Token Budget<br/>Allocation Engine}
    
    TokenAlloc -->|Minimal| T1[200-400 tokens<br/>Brief responses]
    TokenAlloc -->|Light| T2[400-900 tokens<br/>Standard answers]
    TokenAlloc -->|Standard| T3[900-1800 tokens<br/>Detailed guidance]
    TokenAlloc -->|Comprehensive| T4[1800-3200 tokens<br/>In-depth analysis]
    TokenAlloc -->|Extensive| T5[3200-6000 tokens<br/>Complex solutions]
    TokenAlloc -->|Massive| T6[6000-12000 tokens<br/>Exhaustive coverage]
    
    %% Intelligence Signals
    subgraph ISP[Intelligence Signal Processing]
        IS1[Keywords: comprehensive,<br/>in-depth, step-by-step]
        IS2[Code/Math Detection:<br/>Plus 30-40% tokens]
        IS3[Multi-part Requests:<br/>Plus 50% tokens]
        IS4[Quick/Brief/Summary:<br/>Minus 50% tokens]
    end
    
    IS1 & IS2 & IS3 & IS4 --> TokenAlloc
    
    %% Preflight Decision Output
    GPT41 & GPT41Heavy & GPT5 & GPT5Think --> PreflightDecision[Preflight Decision Package]
    T1 & T2 & T3 & T4 & T5 & T6 --> PreflightDecision
    
    PreflightDecision --> MainPipeline[Main Processing Pipeline<br/>with Optimized Resources]
    
    %% Performance Metrics
    PreflightModule -.-> Metrics[Performance Metrics<br/>Under 200ms total]
    Metrics --> M1[Feature Extraction: 50ms]
    Metrics --> M2[Context Evaluation: 30ms]
    Metrics --> M3[Model Analysis: 100ms]
    Metrics --> M4[Decision Output: 20ms]
    
    %% Styling
    style UserQuery fill:#e1f5fe
    style PreflightModule fill:#fff3e0
    style RapidAnalysis fill:#f3e5f5
    style ModelSelect fill:#e8f5e8
    style TokenAlloc fill:#fce4ec
    style PreflightDecision fill:#f0f4c3
    style MainPipeline fill:#e8eaf6
    style Metrics fill:#ffebee
```

### Preflight Decision Logic Detail

```mermaid
graph LR
    %% Query Analysis
    Query[User Query] --> Analyzer[Query Analyzer]
    
    Analyzer --> ComplexityScore{Complexity Score}
    
    ComplexityScore -->|0-2| Simple[Simple Query<br/>- Yes/No questions<br/>- Basic definitions<br/>- Quick lookups]
    ComplexityScore -->|3-5| Moderate[Moderate Query<br/>- Implementation steps<br/>- Tool explanations<br/>- Process guidance]
    ComplexityScore -->|6-8| Complex[Complex Query<br/>- Multi-step reasoning<br/>- Strategic planning<br/>- Integration scenarios]
    ComplexityScore -->|9-10| Extreme[Extreme Query<br/>- Enterprise planning<br/>- Mathematical proofs<br/>- System architecture]
    
    %% Model Mapping
    Simple --> ModelSimple[GPT-4.1<br/>200-900 tokens]
    Moderate --> ModelModerate[GPT-4.1<br/>900-3200 tokens]
    Complex --> ModelComplex[GPT-5<br/>3200-6000 tokens]
    Extreme --> ModelExtreme[GPT-5 + Thinking<br/>6000-12000 tokens]
    
    %% Special Cases
    subgraph SC[Special Case Handling]
        SC1[Code Present: +40% tokens]
        SC2[Math Present: +40% tokens]
        SC3[Artifact Open: Consider UI space]
        SC4[Nexus Mode: Higher baseline]
    end
    
    SC1 & SC2 & SC3 & SC4 -.-> ModelSimple
    SC1 & SC2 & SC3 & SC4 -.-> ModelModerate
    SC1 & SC2 & SC3 & SC4 -.-> ModelComplex
    SC1 & SC2 & SC3 & SC4 -.-> ModelExtreme
```

---

## FIG. 9: Artifact System Architecture

### Comprehensive Artifact Generation and Management System

```mermaid
flowchart TB
    %% Core Module
    AGM[Artifact Generation Module<br/>components/artifact.tsx] --> Coordinator[Artifact Coordinator<br/>Type Detection & Routing]
    
    %% Artifact Type Detection
    Coordinator --> TypeDetect{Artifact Type<br/>Detection Engine}
    
    TypeDetect -->|Text Request| TextEngine[Text Editor Engine<br/>artifacts/text/client.tsx]
    TypeDetect -->|Code Request| CodeEngine[Code Editor Engine<br/>artifacts/code/client.tsx]
    TypeDetect -->|Data/Table| SpreadEngine[Spreadsheet Engine<br/>artifacts/sheet/client.tsx]
    TypeDetect -->|Visualization| ChartEngine[Chart Renderer<br/>artifacts/chart/client.tsx]
    TypeDetect -->|Image Request| ImageEngine[Image Generator<br/>artifacts/image/client.tsx]
    TypeDetect -->|V/TO Request| VTOEngine[V/TO Builder<br/>artifacts/vto/client.tsx]
    
    %% Text Editor Features
    TextEngine --> TE1[Rich Text Formatting<br/>Markdown Support]
    TextEngine --> TE2[Real-time Collaboration<br/>Conflict Resolution]
    TextEngine --> TE3[Version History<br/>Change Tracking]
    
    %% Code Editor Features
    CodeEngine --> CE1[Monaco Editor Core<br/>VS Code Engine]
    CodeEngine --> CE2[Syntax Highlighting<br/>50+ Languages]
    CodeEngine --> CE3[IntelliSense<br/>Auto-completion]
    CodeEngine --> CE4[Multi-file Support<br/>Project Structure]
    
    %% Spreadsheet Features
    SpreadEngine --> SE1[Formula Engine<br/>Excel Compatible]
    SpreadEngine --> SE2[Cell Formatting<br/>Conditional Styles]
    SpreadEngine --> SE3[Data Validation<br/>Input Controls]
    SpreadEngine --> SE4[Pivot Tables<br/>Data Analysis]
    
    %% Chart Features
    ChartEngine --> CHE1[Chart.js Core<br/>Dynamic Rendering]
    ChartEngine --> CHE2[Multiple Chart Types<br/>Line/Bar/Pie/Scatter]
    ChartEngine --> CHE3[Interactive Controls<br/>Zoom/Pan/Filter]
    ChartEngine --> CHE4[Real-time Updates<br/>Live Data Binding]
    
    %% Image Features
    ImageEngine --> IE1[AI Generation<br/>DALL-E Integration]
    ImageEngine --> IE2[Style Controls<br/>Artistic Parameters]
    ImageEngine --> IE3[Resolution Options<br/>Quality Settings]
    
    %% V/TO Builder Features
    VTOEngine --> VE1[EOS Structure<br/>All 8 Components]
    VTOEngine --> VE2[Interactive Forms<br/>Guided Input]
    VTOEngine --> VE3[Validation Rules<br/>EOS Compliance]
    VTOEngine --> VE4[PDF Generation<br/>Professional Output]
    
    %% Shared Systems
    TextEngine & CodeEngine & SpreadEngine & ChartEngine & ImageEngine & VTOEngine --> SharedSystems[Shared Infrastructure]
    
    SharedSystems --> Version[Version Control System<br/>lib/artifacts/version-control.ts]
    SharedSystems --> Export[Export Module<br/>lib/artifacts/export.ts]
    SharedSystems --> Stream[Streaming Protocol<br/>lib/artifacts/streaming.ts]
    SharedSystems --> Persist[Persistence Layer<br/>lib/db/artifacts.ts]
    SharedSystems --> Collab[Collaboration Engine<br/>lib/artifacts/collaboration.ts]
    
    %% Version Control Detail
    Version --> VC1[Change Tracking<br/>Diff Generation]
    Version --> VC2[Branch Management<br/>Merge Conflicts]
    Version --> VC3[Rollback Support<br/>History Navigation]
    
    %% Export Options
    Export --> EX1[PDF Export<br/>Print-ready]
    Export --> EX2[Word/Excel<br/>Native Formats]
    Export --> EX3[JSON/CSV<br/>Data Exchange]
    Export --> EX4[Image Export<br/>PNG/JPEG/SVG]
    
    %% Streaming Detail
    Stream --> ST1[WebSocket Protocol<br/>Real-time Updates]
    Stream --> ST2[Chunk Management<br/>Progressive Rendering]
    Stream --> ST3[Error Recovery<br/>Resilient Streaming]
    
    %% Persistence Detail
    Persist --> DB[(PostgreSQL<br/>Artifact Storage)]
    Persist --> Cache[(Redis Cache<br/>Performance Layer)]
    Persist --> S3[(S3 Storage<br/>Large Files)]
    
    %% UI Integration
    SharedSystems --> UILayer[UI Integration Layer]
    UILayer --> SidePanel[Side Panel View<br/>components/artifact-panel.tsx]
    UILayer --> FullScreen[Full Screen Mode<br/>Immersive Editing]
    UILayer --> Preview[Preview Mode<br/>Read-only Display]
    
    %% Styling
    style AGM fill:#e1f5fe
    style Coordinator fill:#fff3e0
    style SharedSystems fill:#f0f4c3
    style TextEngine fill:#e8f5e8
    style CodeEngine fill:#f3e5f5
    style SpreadEngine fill:#ffebee
    style ChartEngine fill:#fce4ec
    style ImageEngine fill:#fff8e1
    style VTOEngine fill:#e8eaf6
```

### Artifact Lifecycle and Data Flow

```mermaid
sequenceDiagram
    participant User
    participant Chat
    participant Preflight
    participant AGM as Artifact Module
    participant Engine as Specific Engine
    participant Stream as Streaming Protocol
    participant UI as User Interface
    participant DB as Database
    
    User->>Chat: Sends query
    Chat->>Preflight: Analyze query
    Preflight->>Chat: Determine artifact need
    
    alt Artifact Required
        Chat->>AGM: Initialize artifact
        AGM->>Engine: Create specific type
        Engine->>Stream: Begin streaming
        
        loop Real-time Generation
            Engine->>Stream: Send content chunks
            Stream->>UI: Update display
            UI->>User: Show progress
        end
        
        Engine->>DB: Save artifact
        DB->>AGM: Return artifact ID
        AGM->>Chat: Artifact ready
        Chat->>User: Brief acknowledgment
    else Standard Response
        Chat->>User: Text response only
    end
    
    %% User Editing
    User->>UI: Edit artifact
    UI->>Engine: Process changes
    Engine->>DB: Update version
    Engine->>Stream: Broadcast changes
    Stream->>UI: Sync all viewers
```

### V/TO Builder Component Architecture

```mermaid
graph TD
    %% V/TO Structure
    VTO[V/TO Builder] --> Components[8 Core Components]
    
    Components --> CV[Core Values<br/>3-7 values]
    Components --> CF[Core Focus<br/>Purpose + Niche]
    Components --> TYT[10-Year Target<br/>BHAG]
    Components --> MS[Marketing Strategy]
    Components --> TYP[3-Year Picture]
    Components --> OYP[1-Year Plan]
    Components --> QR[Quarterly Rocks]
    Components --> IL[Issues List]
    
    %% Marketing Strategy Breakdown
    MS --> MS1[Target Market]
    MS --> MS2[3 Uniques]
    MS --> MS3[Proven Process]
    MS --> MS4[Guarantee]
    
    %% 3-Year Picture Breakdown
    TYP --> TYP1[Future Date]
    TYP --> TYP2[Revenue Target]
    TYP --> TYP3[Profit Target]
    TYP --> TYP4[Measurables]
    
    %% Interactive Features
    subgraph "Interactive Editing"
        IE1[Inline Editing]
        IE2[Drag & Drop]
        IE3[Auto-save]
        IE4[Validation]
    end
    
    CV & CF & TYT & MS & TYP & OYP & QR & IL --> IE1
    CV & CF & TYT & MS & TYP & OYP & QR & IL --> IE2
    CV & CF & TYT & MS & TYP & OYP & QR & IL --> IE3
    CV & CF & TYT & MS & TYP & OYP & QR & IL --> IE4
    
    %% Export Options
    VTO --> Export[Export Options]
    Export --> PDF[PDF Export<br/>Professional Format]
    Export --> Word[Word Export<br/>Editable Document]
    Export --> Share[Share Link<br/>Collaboration]
```

---

## Integration Between Preflight and Artifact Systems

### Combined System Flow

```mermaid
flowchart LR
    %% Query Processing
    Query[User Query] --> Preflight[Preflight Analysis]
    
    Preflight --> Decision{Resource Allocation}
    
    Decision --> ModelChoice[Model: GPT-4.1/5<br/>Tokens: 200-12k]
    Decision --> ArtifactCheck{Artifact Needed?}
    
    ArtifactCheck -->|Yes| ArtifactInit[Initialize Artifact]
    ArtifactCheck -->|No| StandardResponse[Text Response]
    
    %% Artifact Creation
    ArtifactInit --> ArtifactType{Determine Type}
    
    ArtifactType --> CreateDoc[Create Document]
    ArtifactType --> CreateCode[Create Code]
    ArtifactType --> CreateSheet[Create Spreadsheet]
    ArtifactType --> CreateChart[Create Chart]
    ArtifactType --> CreateVTO[Create V/TO]
    
    %% Parallel Processing
    ModelChoice --> AIGeneration[AI Content Generation]
    
    CreateDoc & CreateCode & CreateSheet & CreateChart & CreateVTO --> Stream[Stream to UI]
    AIGeneration --> Stream
    
    Stream --> Display[Display to User]
    
    %% Feedback Loop
    Display --> UserEdit[User Edits]
    UserEdit --> UpdateArtifact[Update Artifact]
    UpdateArtifact --> SaveVersion[Save Version]
    
    %% Performance Monitoring
    Preflight -.-> Metrics[Performance Metrics]
    Stream -.-> Metrics
    Metrics --> Analytics[Analytics Dashboard]
    
    %% Styling
    style Query fill:#e1f5fe
    style Preflight fill:#fff3e0
    style ArtifactInit fill:#f3e5f5
    style Stream fill:#e8f5e8
    style Display fill:#fce4ec
```

---

## Technical Implementation Details

### Preflight Configuration Schema

```mermaid
classDiagram
    class PreflightConfig {
        +ModelSelectionCriteria criteria
        +TokenAllocationRules tokenRules
        +PerformanceThresholds thresholds
        +IntelligenceSignals signals
        +decideModel(query) Model
        +allocateTokens(query) number
    }
    
    class ModelSelectionCriteria {
        +complexityThresholds: number[]
        +modelMapping: Map~string, Model~
        +specialCaseRules: Rule[]
        +evaluate(features) string
    }
    
    class TokenAllocationRules {
        +baseTiers: TokenTier[]
        +modifiers: TokenModifier[]
        +calculate(features) number
    }
    
    class TokenTier {
        +name: string
        +minTokens: number
        +maxTokens: number
        +description: string
    }
    
    class IntelligenceSignal {
        +keyword: string
        +impact: number
        +operation: string
    }
    
    PreflightConfig --> ModelSelectionCriteria
    PreflightConfig --> TokenAllocationRules
    TokenAllocationRules --> TokenTier
    PreflightConfig --> IntelligenceSignal
```

### Artifact Type Registry

```mermaid
classDiagram
    class ArtifactRegistry {
        +types: Map
        +register(type) void
        +create(kind, params) Artifact
        +getRenderer(kind) Renderer
    }
    
    class ArtifactType {
        <<interface>>
        +kind: string
        +description: string
        +supportedFormats: string[]
        +createEngine() Engine
        +createRenderer() Renderer
    }
    
    class TextArtifact {
        +kind: text
        +richTextCapabilities: boolean
        +collaborationEnabled: boolean
    }
    
    class CodeArtifact {
        +kind: code
        +languages: string[]
        +monacoConfig: object
    }
    
    class VTOArtifact {
        +kind: vto
        +eosComponents: Component[]
        +validationRules: Rule[]
    }
    
    ArtifactRegistry --> ArtifactType
    TextArtifact ..|> ArtifactType
    CodeArtifact ..|> ArtifactType
    VTOArtifact ..|> ArtifactType
```

---

## Summary

These diagrams illustrate the sophisticated technical architecture of the EOS AI Bot's preflight screening and artifact generation systems. The preflight system provides intelligent resource optimization with sub-200ms decision making, while the artifact system transforms conversational AI into a comprehensive document creation and collaboration platform. Together, they represent significant innovations in AI-powered business methodology implementation.

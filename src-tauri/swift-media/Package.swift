// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "MediaPlugin",
    platforms: [.macOS(.v12)],
    products: [
        .library(name: "MediaPlugin", type: .static, targets: ["MediaPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/Brendonovich/swift-rs", from: "1.0.7")
    ],
    targets: [
        .target(
            name: "MediaPlugin",
            dependencies: [
                .product(name: "SwiftRs", package: "swift-rs")
            ]
        )
    ]
)

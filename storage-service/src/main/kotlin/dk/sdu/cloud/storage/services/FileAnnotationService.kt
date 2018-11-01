package dk.sdu.cloud.storage.services

import dk.sdu.cloud.file.api.StorageEvent
import dk.sdu.cloud.file.api.StorageEventProducer
import dk.sdu.cloud.file.api.validateAnnotation
import dk.sdu.cloud.storage.util.unwrap
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import java.util.UUID

class FileAnnotationService<Ctx : FSUserContext>(
    private val fs: LowLevelFileSystemInterface<Ctx>,
    private val storageEventProducer: StorageEventProducer
) {
    fun annotateFiles(ctx: Ctx, path: String, annotation: String) {
        validateAnnotation(annotation)

        fs.setExtendedAttribute(ctx, path, "annotate${UUID.randomUUID().toString().replace("-", "")}", annotation)
            .unwrap()

        val stat = fs.stat(
            ctx, path, setOf(
                FileAttribute.INODE,
                FileAttribute.PATH,
                FileAttribute.OWNER,
                FileAttribute.ANNOTATIONS
            )
        ).unwrap()

        GlobalScope.launch {
            storageEventProducer.emit(
                StorageEvent.AnnotationsUpdated(
                    stat.inode,
                    stat.path,
                    stat.owner,
                    System.currentTimeMillis(),
                    stat.annotations,
                    ctx.user
                )
            )
        }
    }
}
